/**
 * The payment adapter for the app's real money path.
 *
 * One balance, one address, and sends that the user's own wallet signs:
 *
 *  - **the balance** is the wallet's on-chain mUSD. Not a ledger figure, not a
 *    vault figure — the token the address actually holds.
 *  - **a send** is a direct mUSD `transfer` from that wallet to the recipient's
 *    address, broadcast by the embedded wallet itself.
 *  - **the record** is the server's, written after the transfer is on-chain.
 *    The server resolves a recipient and files a row; it never holds funds and
 *    never moves them, so a failure to record is a gap in Activity, not a
 *    failed send.
 *
 * That division is why this file is more careful than the ledger adapter it
 * replaces. When the server moved the money, the client could treat a thrown
 * error as "nothing happened". Here the client *is* the money path, so every
 * failure has to be reported as what it actually is:
 *
 *  - a refusal is decided before the wallet is asked, so no prompt appears and
 *    no gas is spent — which is why the checks behind it are the ones that have
 *    to be right;
 *  - a rejected prompt means nothing was signed and nothing moved;
 *  - a revert means the transaction is on-chain and did not do what was asked;
 *  - a timeout means the transfer was broadcast and *this client* could not read
 *    its receipt — which is not the same as failed, and must never be reported
 *    as failed. It is not the same as unconfirmed either: the server reads the
 *    same chain for itself, so a timeout is put to it before anything is said.
 *
 * The last one is the one that costs money if it is wrong, so it is the one the
 * wording is most careful about. It deliberately does NOT claim the reconciler
 * will settle it: the reconciler matches vault payments by `paymentId`, and a
 * direct transfer has no vault leg, so it is out of its reach.
 */

import { isAddress, type WalletClient } from "viem";
import { ApiError, type AuthedFetch } from "@/lib/auth/client";
import { getPublicClient, MUSD_ABI } from "@/lib/mezo/musd";
import { MUSD_ADDRESS, CHAIN_ID } from "@/lib/mezo/config";
import {
  formatUnits,
  toChainUnits,
  toDisplayUnits,
  unitsToDecimal,
} from "./amount";
import { formatAssetAmount } from "./asset-amount";
import type {
  PaymentService,
  Recipient,
  SendRequest,
  SendResult,
  Transaction,
} from "./payment.types";
import { createApiPaymentService } from "./api-payment.adapter";

/**
 * How long to wait for the transfer to be mined before saying so.
 *
 * Mezo mines in about seven seconds, so this is several blocks' worth. It is
 * not larger because waiting longer buys nothing: the record route reads the
 * same receipt from the same chain and answers in under a second, so a wait
 * that has not answered in 30s is a wait that is not going to — and making the
 * user watch a spinner for a minute before the app asks the question a second,
 * cheaper way is a minute of their time spent on nothing.
 */
const RECEIPT_TIMEOUT_MS = 30_000;

/**
 * The gas pinned on a transfer, in place of letting the node price it.
 *
 * `writeContract` would call `eth_estimateGas` and use what comes back. This
 * RPC is on record, in this repo's own proof scripts, for sometimes answering
 * that with a figure at or below the intrinsic cost — which is where "gas limit
 * must not be zero" comes from. A `transfer` to a recipient holding nothing
 * measures 51,685 gas against this token, so a
 * recipient whose balance slot is being created is already the expensive case,
 * and 65,000 covers it with a quarter to spare.
 *
 * Over-pinning is free — gas the transaction does not use is refunded — while
 * under-pinning a real transfer would spend gas to run out of it. That
 * asymmetry is the whole reason for a fixed ceiling rather than an estimate.
 */
const TRANSFER_GAS_CEILING = 65_000n;

/** A truncated address, for showing a counterparty that has no handle. */
function shorten(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Did the user turn the prompt down?
 *
 * viem surfaces this as a `UserRejectedRequestError` whose message varies by
 * connector ("User rejected the request.", "User denied transaction"), and
 * Privy's embedded wallet has its own spelling. Matching on the words rather
 * than on one class name is the version that keeps working across providers —
 * and getting it wrong in the other direction would tell a user who simply
 * changed their mind that their money had a problem.
 */
function isUserRejection(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  const message = e instanceof Error ? e.message : String(e);
  return (
    name === "UserRejectedRequestError" ||
    /reject|denied|declined|cancell?ed by user/i.test(message)
  );
}

/** The name to show for whoever is being paid. */
function nameOf(recipient: Recipient): string {
  return recipient.name || recipient.handle || shorten(recipient.address ?? "");
}

export function createChainPaymentService(deps: {
  fetchAuthed: AuthedFetch;
  /**
   * The wallet that signs. A getter, not a value: the services are built once
   * for the lifetime of the mount and the embedded wallet can arrive after
   * that, so anything captured at build time would be permanently `null`.
   */
  getWalletClient: () => WalletClient | null;
  /** The wallet's address, read the same way and for the same reason. */
  getWalletAddress: () => string | null;
}): PaymentService {
  const { fetchAuthed, getWalletClient, getWalletAddress } = deps;

  /*
    History is the server's records — that has not changed and should not: the
    chain can say a transfer happened, but not who the user meant by it, and
    not what they called them. Reusing the ledger adapter's listing means one
    definition of "the activity list" rather than two that can disagree.
  */
  const records = createApiPaymentService({ fetchAuthed });

  let client: ReturnType<typeof getPublicClient> | null = null;
  const rpc = () => (client ??= getPublicClient());

  /**
   * What the server said about a transfer this client has already broadcast.
   *
   * The three cases are different facts about the user's money, so they are
   * kept apart rather than flattened into "a row or no row":
   *
   *  - `verified` — the route read the receipt itself and matched the token
   *    contract, the recipient, the exact amount and the sender. That is a
   *    second, independent read of the same chain, and it is authoritative.
   *  - `refused` — the chain disagreed with the claim (HTTP 422), and the
   *    reason is the verifier's. A 403 is deliberately *not* this case: it says
   *    the server would not file the row, not that the transfer was bad, and
   *    reading it as a failed send would be the very false claim this type
   *    exists to prevent.
   *  - `unknown` — no answer, a row filed as pending, or any other refusal.
   *    Nothing is established, so nothing is claimed.
   */
  type Filed =
    | { state: "verified"; id: string | null }
    | { state: "refused"; reason: string }
    | { state: "unknown"; id: string | null };

  /**
   * Tell the server about a transfer that is already on-chain. Best-effort by
   * design: the money has moved either way, so a bookkeeping failure must not
   * be reported as a payment failure — it is logged and the send carries on.
   *
   * It reports the verdict rather than just the row id, because the route does
   * not take this client's word for anything: it reads the receipt for itself
   * and files PAID only after checking the transfer. That is a second read of
   * the same chain, which makes it worth consulting when this client's own read
   * has failed — and worth keeping rather than discarding, which is what the
   * send flow below used to do.
   */
  async function record(
    txHash: `0x${string}`,
    to: string,
    amountUnits: bigint,
  ): Promise<Filed> {
    try {
      const res = await fetchAuthed<{ id?: string; status?: string }>(
        "/api/payments/record",
        {
          method: "POST",
          body: JSON.stringify({
            txHash,
            recipient: to,
            amount: unitsToDecimal(amountUnits),
          }),
        },
      );
      const id = res?.id ?? null;
      return res?.status === "PAID"
        ? { state: "verified", id }
        : { state: "unknown", id };
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        return { state: "refused", reason: e.message };
      }
      console.error("[pocket] transfer not recorded", {
        txHash,
        error: e instanceof Error ? e.message : String(e),
      });
      return { state: "unknown", id: null };
    }
  }

  /**
   * Whether this transfer can happen, answered before anything is signed.
   *
   * Returns the sentence to refuse with, or `null` to go ahead. Both checks are
   * `eth_call`s: they cost no gas, change no state, and need no signature.
   *
   *   1. **What the signer holds.** Read from `wallet.account.address` — the
   *      address that will actually sign — rather than from the address the app
   *      displays. A balance read from one wallet and a signature from another
   *      is precisely the mistake this exists to catch, and the signer's own
   *      `balanceOf` is the only read that can see it. A view call: it cannot
   *      revert, so a failure here means the RPC is unreachable, not that the
   *      transfer is bad.
   *
   *   2. **Whether the token accepts it.** `simulateContract` runs the transfer
   *      and discards the result, which catches what a balance cannot: a paused
   *      token, a blocked address, a recipient the chain will not credit. It is
   *      what makes "the app refused" and "the chain refused" the same answer.
   */
  async function preflight(
    from: `0x${string}`,
    to: string,
    amount: bigint,
  ): Promise<string | null> {
    let held: bigint | null = null;
    try {
      held = (await rpc().readContract({
        abi: MUSD_ABI,
        address: MUSD_ADDRESS,
        functionName: "balanceOf",
        args: [from],
      })) as bigint;
    } catch {
      /*
        The read failed, so the balance is unknown and this check cannot speak
        to it. Not fatal: the simulation below is still a real check, and the
        only thing lost is a message naming the reason.
      */
      held = null;
    }

    if (held !== null && held < amount) {
      /*
        The address is in the message deliberately. The usual way to arrive here
        is a wallet the user did not mean to be in — a second account, an
        embedded wallet that is not the one holding the money — and the figure
        alone would leave them comparing it against a balance the app is showing
        for some other address.
      */
      return `This wallet holds ${formatUnits(toDisplayUnits(held))} mUSD — not enough for that transfer. (${shorten(from)})`;
    }

    try {
      await rpc().simulateContract({
        account: from,
        address: MUSD_ADDRESS,
        abi: MUSD_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, amount],
      });
    } catch (e) {
      console.error("[pocket] transfer preflight failed", {
        from,
        error: e instanceof Error ? e.message : String(e),
      });
      /*
        Worded for what is known rather than for the likeliest cause. A revert
        and an unreachable RPC arrive here looking the same — this chain wraps a
        revert as an opaque `rpc error: code = Unknown desc = .` — so naming one
        of them would be a guess dressed up as a diagnosis. What is certain is
        that the check did not pass and nothing was signed.
      */
      return "This transfer could not be checked against the chain, so it was not sent. Nothing has left your wallet.";
    }

    return null;
  }

  return {
    async getBalance(): Promise<bigint> {
      const address = getWalletAddress();
      /*
        No address is not a zero balance. Throwing lets the store keep the last
        figure it had and report the read as failed, where returning `0n` would
        print a real-looking `$0.00` over money the user may still hold.
      */
      if (!address) throw new Error("Wallet address not available yet");

      const raw = await rpc().readContract({
        abi: MUSD_ABI,
        address: MUSD_ADDRESS,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      // Chain units (18 decimals) → the UI's minor units, where it is rounded
      // down and never up. See `toDisplayUnits`.
      return toDisplayUnits(raw as bigint);
    },

    listTransactions: () => records.listTransactions(),

    async send(request: SendRequest): Promise<SendResult> {
      if (request.amountUnits <= 0n) {
        return { ok: false, error: "Enter an amount greater than zero." };
      }

      const to = request.recipient.address;
      /*
        An address is the only thing that can receive a transfer. The store
        checks this too, but this is the boundary where money moves, and a
        recipient that resolved to nothing must not reach the chain.
      */
      if (!to || !isAddress(to)) {
        return { ok: false, error: "That contact has no address to pay yet." };
      }

      const wallet = getWalletClient();
      if (!wallet?.account) {
        return { ok: false, error: "Your wallet is not ready yet. Try again in a moment." };
      }

      /*
        Sending on the wrong chain would sign a transfer of a different token
        wearing this one's name. Refusing is cheap; the alternative is money
        arriving somewhere the user did not mean and cannot see.
      */
      if (wallet.chain && wallet.chain.id !== CHAIN_ID) {
        return { ok: false, error: `Switch to Mezo to send MUSD.` };
      }

      const amount = toChainUnits(request.amountUnits);
      const name = nameOf(request.recipient);
      const signer = wallet.account.address as `0x${string}`;

      /*
        Ask the chain before the wallet asks the user.

        Without this the Privy prompt is the first thing to discover that the
        transfer cannot happen, and it discovers it in the least legible way
        available: the transfer reverts inside its own gas estimate, so the
        prompt has no price to show and reports "gas limit must not be zero" and
        "Missing or invalid parameters" over a wallet that simply holds no
        mUSD. Both are symptoms of a revert, and both read as the app having
        built a malformed request. Checking first replaces them with a sentence
        in the app's own voice, about the actual reason.
      */
      const refused = await preflight(signer, to, amount);
      if (refused) return { ok: false, error: refused };

      // 1. Sign and broadcast. Nothing has moved if this throws.
      let hash: `0x${string}`;
      try {
        hash = await wallet.writeContract({
          account: wallet.account,
          chain: wallet.chain,
          address: MUSD_ADDRESS,
          abi: MUSD_ABI,
          functionName: "transfer",
          args: [to as `0x${string}`, amount],
          gas: TRANSFER_GAS_CEILING,
        });
      } catch (e) {
        if (isUserRejection(e)) {
          return { ok: false, error: "You declined the transfer. Nothing was sent." };
        }
        console.error("[pocket] transfer not broadcast", {
          error: e instanceof Error ? e.message : String(e),
        });
        return {
          ok: false,
          error: "Could not send the transfer. Nothing has left your wallet.",
        };
      }

      /*
        2. Wait for it to be mined.

        A throw here does not mean the transfer failed, and it does not even
        mean the transfer is young. This RPC is on record, under this repo's own
        measurement, for answering
        `TransactionReceiptNotFound` for a transfer buried hundreds of blocks
        deep, and then answering fine for the same hash seconds later. So the
        only thing a throw establishes is that *this client* could not read the
        receipt — which is a different fact from the chain's, and would be a
        false claim about the user's money if it were reported as one.
      */
      let mined: "success" | "reverted" | null = null;
      try {
        const receipt = await rpc().waitForTransactionReceipt({
          hash,
          timeout: RECEIPT_TIMEOUT_MS,
        });
        mined = receipt.status;
      } catch (e) {
        console.error("[pocket] receipt not read", {
          hash,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      if (mined === "reverted") {
        // On-chain and refused — the money did not move. The record route will
        // reject this same claim, so there is deliberately no row filed here.
        return {
          ok: false,
          error: "The transfer was rejected on-chain. Nothing was sent.",
        };
      }

      /*
        3. Record it — and let the server settle the case this client could not.

        The route reads the receipt for itself and files PAID only when the
        token contract, the recipient, the exact amount and the sender all
        match, so its answer is a verification rather than an echo. That makes
        it the right tie-breaker above: when the wait threw but the server comes
        back PAID, the transfer is confirmed as a matter of fact and the user
        should be told it succeeded.

        This is the bug being fixed here. The verdict was arriving and being
        discarded — the client kept only the row id — so a transfer the server
        had already verified as PAID was reported to the user as unconfirmed.
      */
      const filed = await record(hash, to, request.amountUnits);

      if (mined === null && filed.state === "refused") {
        /*
          The chain disagreed with the claim. The verifier's reason is written to
          name what did not match, not to be read by the person who sent the
          money, so the sentence is the app's and the reason is kept for the log.
        */
        console.error("[pocket] transfer refused by the chain", {
          hash,
          reason: filed.reason,
        });
        return {
          ok: false,
          error:
            filed.reason === "Transaction reverted"
              ? "The transfer was rejected on-chain. Nothing was sent."
              : "The chain did not accept that transfer. Nothing was recorded.",
        };
      }

      if (mined === null && filed.state !== "verified") {
        /*
          Broadcast, and neither reader has established what became of it. That
          is the honest state and it is said as one: the transfer is out there,
          and whether it landed is not known. Calling it a failure would be a
          claim this code cannot support.
        */
        return {
          ok: false,
          error: `The transfer was sent but has not confirmed yet. It may still complete — check Activity before sending again. (${hash})`,
        };
      }

      // Confirmed — by this client's own receipt, or by the server's
      // independent read of the chain when this client's read failed.
      const id = filed.state === "refused" ? null : filed.id;
      const now = new Date();
      const transaction: Transaction = {
        id: id ?? hash,
        recipientId: request.recipient.id || to,
        recipientName: name,
        recipientHandle: request.recipient.handle || shorten(to),
        // This adapter signs `MUSD_ABI.transfer` and nothing else. The chain's
        // gas token is moved by `lib/mezo/btc-actions.ts`, which is deliberately
        // not a `PaymentService` — see the note in `use-btc-actions`.
        asset: "MUSD",
        amountUnits: request.amountUnits,
        amountDisplay: formatAssetAmount("MUSD", request.amountUnits),
        direction: "sent",
        status: "confirmed",
        kind: "onchain",
        createdAt: now,
        txHash: hash,
      };

      return { ok: true, transaction };
    },
  };
}
