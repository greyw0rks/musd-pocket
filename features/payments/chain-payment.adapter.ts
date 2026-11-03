/**
 * User-signed mUSD sends with durable recording recovery.
 * Receipt failures retry a hash; they never request another wallet signature.
 */
import { isAddress, type WalletClient } from "viem";
import { type AuthedFetch } from "@/lib/auth/client";
import { getPublicClient, MUSD_ABI } from "@/lib/mezo/musd";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";
import {
  parseDecimalToUnits,
  toChainUnits,
  toDisplayUnits,
  unitsToDecimal,
} from "./amount";
import { formatAssetAmount } from "./asset-amount";
import type {
  PaymentService,
  SendRequest,
  SendResult,
  Transaction,
} from "./payment.types";
import { createApiPaymentService } from "./api-payment.adapter";
import { createSendJournal, type JournalEntry } from "./send-journal";
import { paymentAmountSchema } from "@/lib/payments/schema";

const RECEIPT_TIMEOUT_MS = 30_000;
const TRANSFER_GAS_CEILING = 65_000n;

export function createChainPaymentService(deps: {
  fetchAuthed: AuthedFetch;
  getWalletClient: () => WalletClient | null;
  getWalletAddress: () => string | null;
  journal?: ReturnType<typeof createSendJournal>;
}): PaymentService {
  const { fetchAuthed, getWalletClient, getWalletAddress } = deps;
  const journal = deps.journal ?? createSendJournal(CHAIN_ID);
  const records = createApiPaymentService({ fetchAuthed });
  const inFlight = new Map<string, Promise<SendResult>>();
  const completed = new Map<
    string,
    { amount: string; to: string; result: SendResult }
  >();
  const history = new Map<string, Transaction[]>();
  let refreshWork: { sender: string; work: Promise<Transaction[]> } | null =
    null;
  let client: ReturnType<typeof getPublicClient> | null = null;
  const rpc = () => (client ??= getPublicClient());

  function transaction(entry: JournalEntry): Transaction {
    const amountUnits = parseDecimalToUnits(entry.amount)!;
    return {
      id: entry.hash,
      recipientId: entry.recipient.id,
      recipientName: entry.recipient.name,
      recipientHandle: entry.recipient.handle,
      asset: "MUSD",
      amountUnits,
      amountDisplay: formatAssetAmount("MUSD", amountUnits),
      direction: "sent",
      status: entry.status,
      kind: "onchain",
      createdAt: new Date(entry.createdAt),
      txHash: entry.hash,
      chainId: CHAIN_ID,
      error: entry.error,
    };
  }

  async function record(entry: JournalEntry): Promise<JournalEntry> {
    let updated = entry;
    try {
      const response = await fetchAuthed<{ status: string }>(
        "/api/payments/record",
        {
          method: "POST",
          body: JSON.stringify({
            txHash: entry.hash,
            recipient: entry.recipient.address,
            amount: entry.amount,
          }),
        },
      );
      if (response.status === "PAID")
        updated = { ...entry, status: "confirmed", error: undefined };
      else if (response.status === "FAILED")
        updated = {
          ...entry,
          status: "failed",
          error:
            "This transfer reverted. The mUSD was not sent; network gas may have been spent.",
        };
    } catch {
      // A bookkeeping refusal/timeout cannot prove that funds did not move.
      updated = {
        ...entry,
        error:
          "Confirmation is still being checked. Keep the transaction hash and do not send this payment again.",
      };
    }
    journal.put(updated);
    return updated;
  }

  async function recoverAndList(sender: string) {
    for (const entry of journal.list(sender)) await record(entry);
    // This also recovers pending rows filed on another device.
    await fetchAuthed("/api/payments/recover", { method: "POST" }).catch(
      () => undefined,
    );
    let remote: Transaction[];
    try {
      remote = await records.listTransactions();
      history.set(sender, remote);
    } catch (error) {
      if (!journal.list(sender).length && !history.has(sender)) throw error;
      remote = history.get(sender) ?? [];
    }
    const merged = [...remote];
    for (const entry of journal.list(sender)) {
      const match = remote.find(
        (row) => row.txHash?.toLowerCase() === entry.hash.toLowerCase(),
      );
      if (match?.status === "confirmed" || match?.status === "failed")
        journal.remove(entry);
      else if (!match) merged.push(transaction(entry));
    }
    if (getWalletAddress()?.toLowerCase() !== sender)
      throw new Error("Wallet changed while refreshing payments.");
    return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async function send(
    request: SendRequest,
    sender: string,
  ): Promise<SendResult> {
    const to = request.recipient.address!.toLowerCase();
    const amount = unitsToDecimal(request.amountUnits);
    const attempt = request.idempotencyKey
      ? sender + ":" + request.idempotencyKey
      : null;
    const finished = attempt ? completed.get(attempt) : undefined;
    if (finished)
      return finished.amount === amount && finished.to === to
        ? finished.result
        : {
            ok: false,
            error:
              "This payment attempt already has different details. Start a new payment.",
          };

    const prior = journal
      .list(sender)
      .find(
        (entry) =>
          (request.idempotencyKey &&
            entry.requestKey === request.idempotencyKey) ||
          (entry.status === "pending" &&
            entry.recipient.address?.toLowerCase() === to &&
            entry.amount === amount),
      );
    if (prior) {
      if (
        prior.recipient.address?.toLowerCase() !== to ||
        prior.amount !== amount
      )
        return {
          ok: false,
          error:
            "Check the earlier payment in Activity before changing this attempt.",
        };
      const recovered = await record(prior);
      const result: SendResult = {
        ok: true,
        transaction: transaction(recovered),
      };
      if (attempt && recovered.status !== "pending")
        completed.set(attempt, { amount, to, result });
      return result;
    }

    const wallet = getWalletClient();
    if (!wallet?.account)
      return { ok: false, error: "Your wallet is not ready yet." };
    if (
      wallet.account.address.toLowerCase() !== sender ||
      wallet.chain?.id !== CHAIN_ID
    )
      return {
        ok: false,
        error: "Connect your Pocket wallet on Mezo before sending.",
      };
    try {
      journal.assertWritable();
    } catch {
      return {
        ok: false,
        error:
          "This browser cannot save payment progress. Enable site storage and try again.",
      };
    }

    try {
      if ((await rpc().getChainId()) !== CHAIN_ID)
        throw new Error("Wrong RPC network");
      const simulation = await rpc().simulateContract({
        account: wallet.account.address,
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, toChainUnits(request.amountUnits)],
      });
      if (!simulation.result) throw new Error("Token refused transfer");
    } catch {
      return {
        ok: false,
        error:
          "The transfer could not be prepared. Check your mUSD and BTC gas balance, then try again.",
      };
    }

    let hash: `0x${string}`;
    try {
      hash = await wallet.writeContract({
        account: wallet.account,
        chain: wallet.chain,
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, toChainUnits(request.amountUnits)],
        gas: TRANSFER_GAS_CEILING,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: /user rejected|user denied|declined|cancelled by user/i.test(
          message,
        )
          ? "You declined the transfer. Nothing was sent."
          : "The wallet did not return a transaction hash. Check wallet activity before trying again.",
      };
    }

    let entry: JournalEntry = {
      hash,
      sender,
      recipient: { ...request.recipient, address: to },
      amount,
      createdAt: new Date().toISOString(),
      requestKey: request.idempotencyKey,
      status: "pending",
    };
    journal.put(entry); // Must happen before the first network await after signing.
    entry = await record(entry);
    if (entry.status === "pending") {
      try {
        const receipt = await rpc().waitForTransactionReceipt({
          hash,
          timeout: RECEIPT_TIMEOUT_MS,
        });
        if (receipt.status === "reverted") {
          entry = {
            ...entry,
            status: "failed",
            error:
              "This transfer reverted. The mUSD was not sent; network gas may have been spent.",
          };
          journal.put(entry);
        }
      } catch {
        /* Unknown stays pending; recording recovery uses this hash. */
      }
      entry = await record(entry);
    }
    const result: SendResult = { ok: true, transaction: transaction(entry) };
    if (attempt && entry.status !== "pending")
      completed.set(attempt, { amount, to, result });
    return result;
  }

  return {
    async getBalance() {
      const address = getWalletAddress();
      if (!address) throw new Error("Wallet address not available yet");
      const raw = await rpc().readContract({
        abi: MUSD_ABI,
        address: MUSD_ADDRESS,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      return toDisplayUnits(raw);
    },
    async listTransactions() {
      const sender = getWalletAddress()?.toLowerCase();
      if (!sender) throw new Error("Wallet address not available yet");
      if (refreshWork?.sender === sender) return refreshWork.work;
      const work = recoverAndList(sender);
      refreshWork = { sender, work };
      try {
        return await work;
      } finally {
        if (refreshWork?.work === work) refreshWork = null;
      }
    },
    async send(request) {
      const sender = getWalletAddress()?.toLowerCase();
      const to = request.recipient.address;
      if (!sender) return { ok: false, error: "Sign in before sending." };
      if (request.amountUnits <= 0n)
        return { ok: false, error: "Enter an amount greater than zero." };
      if (
        !paymentAmountSchema.safeParse(unitsToDecimal(request.amountUnits))
          .success
      )
        return {
          ok: false,
          error: "That amount is too large to record. Choose a smaller amount.",
        };
      if (!to || !isAddress(to))
        return { ok: false, error: "That contact has no address to pay yet." };
      const lockKey = `pocket:send:${CHAIN_ID}:${sender}:${to.toLowerCase()}:${request.amountUnits}`;
      if (inFlight.has(lockKey)) return inFlight.get(lockKey)!;
      const work = Promise.resolve().then(async (): Promise<SendResult> => {
        if (typeof navigator !== "undefined" && navigator.locks) {
          return navigator.locks.request(
            lockKey,
            { ifAvailable: true },
            async (lock) =>
              lock
                ? send(request, sender)
                : {
                    ok: false,
                    error:
                      "This payment is already being handled in another tab. Check it there first.",
                  },
          );
        }
        return send(request, sender);
      });
      inFlight.set(lockKey, work);
      try {
        return await work;
      } finally {
        if (inFlight.get(lockKey) === work) inFlight.delete(lockKey);
      }
    },
  };
}
