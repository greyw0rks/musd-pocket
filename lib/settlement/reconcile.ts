import "server-only";

import { parseAbiItem } from "viem";
import { prisma } from "@/lib/db";
import { MUSD_ADDRESS } from "@/lib/mezo/config";
import { getPublicClient } from "@/lib/mezo/musd";
import { getVaultAddress, hasVault, isPaymentProcessed } from "@/lib/mezo/vault";
import { getRelayerWallet } from "@/lib/relayer";
import {
  creditAvailable,
  LedgerError,
  ledgerTx,
  refundToAvailable,
  releaseFrozen,
} from "@/lib/ledger/service";
import type { Prisma } from "@prisma/client";
import {
  decide,
  DEFAULT_GRACE_MS,
  type ChainTruth,
  type Evidence,
  type ReceiptTruth,
} from "./reconcile.decision";

/**
 * Reconciliation — the path that un-freezes money stranded by a crash, a dropped
 * RPC call or a database failure after a payout already landed.
 *
 * Both the send and withdraw routes can leave a row in a non-terminal state
 * while real MUSD has moved (or not). Neither route can safely decide its own
 * case later, because by then it has lost the process that held the context.
 * This module can, because it re-derives the outcome from the chain instead of
 * from its own records — see `reconcile.decision.ts` for the rule it obeys.
 *
 * Every mutation here is idempotent. The gate is the guarded `updateMany` claim
 * on the row's own status: only the run that moves a row out of its
 * non-terminal state performs any work, so two overlapping crons cannot both
 * act on the same payment. Balance moves are additionally tolerant of a repeat,
 * because a crash between the balance write and the status write is possible.
 */

/** How long an attempt stays protected from being read as "never happened". */
const GRACE_MS = (() => {
  const raw = Number(process.env.RECONCILE_GRACE_MS ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GRACE_MS;
})();

/** Cap the work per run so a cron tick never turns into a full table scan. */
const BATCH = (() => {
  const raw = Number(process.env.RECONCILE_BATCH ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 200) : 25;
})();

/** Log scan bounds, matching the anchor used by the deposit indexer. */
const DEPLOY_BLOCK = process.env.POCKET_VAULT_DEPLOY_BLOCK
  ? BigInt(process.env.POCKET_VAULT_DEPLOY_BLOCK)
  : null;
const RECOVERY_LOOKBACK = 50_000n;
const LOG_CHUNK = 10_000n;

export type Outcome = "finalized" | "refunded" | "held" | "failed";

export type ReconcileAction = {
  kind: Outcome;
  subject: "payment" | "withdrawal";
  id: string;
  paymentId: string | null;
  hash: string | null;
  why: string;
};

export type ReconcileReport = {
  scanned: number;
  finalized: number;
  refunded: number;
  held: number;
  failed: number;
  actions: ReconcileAction[];
};

type Tx = Prisma.TransactionClient;

type PaymentRow = Prisma.PaymentGetPayload<{
  include: { sender: { select: { username: true } } };
}>;

type WithdrawalRow = Prisma.WithdrawalGetPayload<Record<string, never>>;

// ----------------------------------------------------------------- chain reads

/**
 * A viem "not found" is the only chain error that carries information: it says
 * the node does not know this hash. Everything else — a timeout, a 429, a
 * malformed response — is us failing to look, and must not be read as an
 * answer.
 */
function isNotFound(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? "";
  return (
    name === "TransactionReceiptNotFoundError" ||
    name === "TransactionNotFoundError"
  );
}

async function readReceipt(hash: string): Promise<ReceiptTruth> {
  try {
    const receipt = await getPublicClient().getTransactionReceipt({
      hash: hash as `0x${string}`,
    });
    return { state: receipt.status === "success" ? "success" : "reverted" };
  } catch (err) {
    return isNotFound(err) ? { state: "not-found" } : { state: "unknown" };
  }
}

async function readChainTruth(
  paymentId: `0x${string}` | null,
): Promise<ChainTruth> {
  // No paymentId means no way to ask the contract. That is unreadable, not
  // "not released" — the difference decides whether a refund is allowed.
  if (!paymentId || !hasVault()) return { state: "unknown" };
  try {
    const processed = await isPaymentProcessed(paymentId);
    return { state: processed ? "released" : "not-released" };
  } catch {
    return { state: "unknown" };
  }
}

/**
 * Whether the relayer has any transaction in flight. A pending/latest nonce gap
 * means one of ours could still land, which makes a silent hash inconclusive.
 * Any failure to establish this reads as "not idle", because the safe default
 * is to assume a transaction might still arrive.
 */
async function readRelayerIdle(): Promise<boolean | null> {
  try {
    const { account } = getRelayerWallet();
    const client = getPublicClient();
    const [pending, latest] = await Promise.all([
      client.getTransactionCount({ address: account.address, blockTag: "pending" }),
      client.getTransactionCount({ address: account.address, blockTag: "latest" }),
    ]);
    return pending === latest;
  } catch {
    return null;
  }
}

/**
 * The two events that mark a release, as standalone items so viem can narrow
 * `args` from them. Both index `paymentId`, which is the whole point: it is what
 * lets a lost transaction hash be recovered from the chain's own log.
 */
const PAYOUT_EVENT = parseAbiItem(
  "event Payout(address indexed to, uint256 amount, bytes32 indexed paymentId)",
);
const WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(address indexed to, uint256 amount, bytes32 indexed paymentId)",
);

/** Fetch release logs for one paymentId over one block range. */
async function fetchReleaseLogs(
  eventName: "Payout" | "Withdraw",
  paymentId: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const address = getVaultAddress();
  const client = getPublicClient();
  if (eventName === "Payout") {
    return client.getLogs({
      address,
      event: PAYOUT_EVENT,
      args: { paymentId },
      fromBlock,
      toBlock,
    });
  }
  return client.getLogs({
    address,
    event: WITHDRAW_EVENT,
    args: { paymentId },
    fromBlock,
    toBlock,
  });
}

/**
 * Find the release transaction for a paymentId whose hash we lost. Both the
 * `Payout` and `Withdraw` events index paymentId, so the chain still knows even
 * when our row does not. Only reached when the contract says the release
 * happened, which makes it a recovery of *labeling*, never of money.
 */
async function recoverReleaseHash(
  paymentId: `0x${string}`,
  eventName: "Payout" | "Withdraw",
): Promise<`0x${string}` | null> {
  if (!hasVault()) return null;
  try {
    const latest = await getPublicClient().getBlockNumber();
    const floor =
      DEPLOY_BLOCK ?? (latest > RECOVERY_LOOKBACK ? latest - RECOVERY_LOOKBACK : 0n);

    for (let start = floor; start <= latest; start += LOG_CHUNK) {
      const end = start + LOG_CHUNK - 1n < latest ? start + LOG_CHUNK - 1n : latest;
      const logs = await fetchReleaseLogs(eventName, paymentId, start, end);
      const hit = logs.find((log) => log.transactionHash);
      if (hit?.transactionHash) return hit.transactionHash;
    }
  } catch (err) {
    console.warn("[reconcile] hash recovery failed", { paymentId, error: String(err) });
  }
  return null;
}

async function gatherEvidence(args: {
  paymentId: `0x${string}` | null;
  hash: string | null;
  createdAt: Date;
}): Promise<Evidence> {
  const { paymentId, hash, createdAt } = args;

  const receipt = hash ? await readReceipt(hash) : null;

  // A successful receipt already settles it; skip the second round-trip.
  const chain: ChainTruth =
    receipt?.state === "success" ? { state: "released" } : await readChainTruth(paymentId);

  const ageMs = Date.now() - createdAt.getTime();

  // Only the "no hash, past grace" branch consults the relayer, so only that
  // branch pays for the call.
  const needsRelayer =
    receipt === null && chain.state === "not-released" && ageMs >= GRACE_MS;
  const relayerIdle = needsRelayer ? await readRelayerIdle() : null;

  return { chain, receipt, ageMs, relayerIdle, graceMs: GRACE_MS };
}

// --------------------------------------------------------------- ledger moves

/**
 * Ledger primitives throw when the balance is already where we want it, which
 * is exactly what a repeat run looks like. Swallowing that — inside the
 * transaction, never rethrowing, since a throw would roll back the status claim
 * too — is what makes a double execution harmless. A non-ledger error still
 * propagates, because that is a real failure and the whole change should abort.
 */
async function tolerant(label: string, paymentId: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof LedgerError) {
      console.warn("[reconcile] balance move already applied", {
        paymentId,
        move: label,
        reason: err.message,
      });
      return;
    }
    throw err;
  }
}

// ------------------------------------------------------------------- payments

function describePayment(payment: PaymentRow, hash: string | null, kind: Outcome, why: string): ReconcileAction {
  return { kind, subject: "payment", id: payment.id, paymentId: payment.paymentId, hash, why };
}

async function reconcilePayment(payment: PaymentRow): Promise<ReconcileAction> {
  const paymentId = payment.paymentId as `0x${string}`;
  const evidence = await gatherEvidence({
    paymentId,
    hash: payment.payoutTxHash,
    createdAt: payment.createdAt,
  });
  const verdict = decide(evidence);

  if (verdict.kind === "hold") {
    return describePayment(payment, payment.payoutTxHash, "held", verdict.why);
  }

  // Recover a lost hash before writing, so the user's history shows the real
  // transaction rather than a row that "paid" with nothing to point at.
  const hash = payment.payoutTxHash ?? (await recoverReleaseHash(paymentId, "Payout"));
  const finalizing = verdict.kind === "finalize";

  try {
    const applied = await ledgerTx(async (tx: Tx) => {
      // The idempotency gate. Whichever run flips the row out of PENDING owns
      // the work; every other overlapping run sees count === 0 and does nothing.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: finalizing
          ? { status: "PAID", paidAt: new Date(), ...(hash ? { payoutTxHash: hash } : {}) }
          : { status: "FAILED" },
      });
      if (claimed.count === 0) return false;

      if (finalizing) {
        // The money left the vault: drop it from the ledger.
        await tolerant("releaseFrozen", payment.paymentId, () =>
          releaseFrozen(tx, payment.senderId, payment.amount.toString()),
        );
        await tx.transaction.updateMany({
          where: { paymentId: payment.paymentId, type: "SEND" },
          data: { status: "COMPLETED", ...(hash ? { txHash: hash } : {}) },
        });

        if (payment.recipientId) {
          // Mirrors the route's receipt row exactly. Guarded because a partial
          // earlier run may already have written it.
          const existing = await tx.transaction.findFirst({
            where: {
              paymentId: payment.paymentId,
              type: "RECEIVE",
              userId: payment.recipientId,
            },
            select: { id: true },
          });
          if (!existing) {
            await tx.transaction.create({
              data: {
                type: "RECEIVE",
                userId: payment.recipientId,
                counterparty: `@${payment.sender.username}`,
                amount: payment.amount,
                token: MUSD_ADDRESS.toLowerCase(),
                sourceChain: "MEZO",
                destChain: "MEZO",
                status: "COMPLETED",
                paymentId: payment.paymentId,
                ...(hash ? { txHash: hash } : {}),
                note: payment.note,
              },
            });
          }
        }
      } else {
        // Nothing moved: give the sender their money back.
        await tolerant("refundToAvailable", payment.paymentId, () =>
          refundToAvailable(tx, payment.senderId, payment.amount.toString()),
        );
        await tx.transaction.updateMany({
          where: { paymentId: payment.paymentId, type: "SEND" },
          data: { status: "FAILED" },
        });
      }
      return true;
    });

    if (!applied) {
      return describePayment(payment, hash, "held", "already resolved by another run");
    }
    return describePayment(payment, hash, finalizing ? "finalized" : "refunded", verdict.why);
  } catch (err) {
    console.error("[reconcile] payment write failed", {
      paymentId: payment.paymentId,
      hash,
      error: String(err),
    });
    return describePayment(payment, hash, "failed", "ledger write failed");
  }
}

// ---------------------------------------------------------------- withdrawals

function describeWithdrawal(
  withdrawal: WithdrawalRow,
  hash: string | null,
  kind: Outcome,
  why: string,
): ReconcileAction {
  return {
    kind,
    subject: "withdrawal",
    id: withdrawal.id,
    paymentId: withdrawal.paymentId,
    hash,
    why,
  };
}

async function reconcileWithdrawal(
  withdrawal: WithdrawalRow,
): Promise<ReconcileAction> {
  const paymentId = (withdrawal.paymentId as `0x${string}` | null) ?? null;
  const evidence = await gatherEvidence({
    paymentId,
    hash: withdrawal.txHash,
    createdAt: withdrawal.createdAt,
  });
  const verdict = decide(evidence);

  if (verdict.kind === "hold") {
    return describeWithdrawal(withdrawal, withdrawal.txHash, "held", verdict.why);
  }

  const hash = withdrawal.txHash ?? (paymentId ? await recoverReleaseHash(paymentId, "Withdraw") : null);
  const finalizing = verdict.kind === "finalize";

  try {
    const applied = await ledgerTx(async (tx: Tx) => {
      const claimed = await tx.withdrawal.updateMany({
        where: { id: withdrawal.id, status: { in: ["PENDING", "PROCESSING"] } },
        data: finalizing
          ? { status: "COMPLETED", ...(hash ? { txHash: hash } : {}) }
          : { status: "FAILED" },
      });
      if (claimed.count === 0) return false;

      if (finalizing) {
        // The withdrawal was debited (not frozen) up front and the money left
        // the vault, so the ledger is already correct — nothing to move.
        if (paymentId) {
          await tx.transaction.updateMany({
            where: { paymentId, type: "WITHDRAW" },
            data: { status: "COMPLETED", ...(hash ? { txHash: hash } : {}) },
          });
        }
      } else {
        // Reverse the debit: funds never left, so they return to available.
        await tolerant("creditAvailable", withdrawal.id, () =>
          creditAvailable(tx, withdrawal.userId, withdrawal.amount.toString()),
        );
        if (paymentId) {
          await tx.transaction.updateMany({
            where: { paymentId, type: "WITHDRAW" },
            data: { status: "FAILED" },
          });
        }
      }
      return true;
    });

    if (!applied) {
      return describeWithdrawal(withdrawal, hash, "held", "already resolved by another run");
    }
    return describeWithdrawal(withdrawal, hash, finalizing ? "finalized" : "refunded", verdict.why);
  } catch (err) {
    console.error("[reconcile] withdrawal write failed", {
      paymentId,
      withdrawalId: withdrawal.id,
      hash,
      error: String(err),
    });
    return describeWithdrawal(withdrawal, hash, "failed", "ledger write failed");
  }
}

// ------------------------------------------------------------------ the entry

/**
 * One reconciliation pass over the oldest unresolved rows.
 *
 * Oldest first on purpose: the longest-frozen funds are the ones a user is most
 * likely to be angry about, and a batch cap means the tail is the part that
 * waits. A run never throws for a single row's failure — it records it and
 * moves on, because one poisoned payment must not stop the rest from clearing.
 */
export async function reconcile(limit: number = BATCH): Promise<ReconcileReport> {
  const take = Math.max(1, Math.min(limit, 200));

  const [payments, withdrawals] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take,
      include: { sender: { select: { username: true } } },
    }),
    prisma.withdrawal.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      take,
    }),
  ]);

  const actions: ReconcileAction[] = [];
  for (const payment of payments) {
    actions.push(await reconcilePayment(payment));
  }
  for (const withdrawal of withdrawals) {
    actions.push(await reconcileWithdrawal(withdrawal));
  }

  for (const action of actions) {
    console.log("[reconcile] decision", {
      kind: action.kind,
      subject: action.subject,
      id: action.id,
      paymentId: action.paymentId,
      txHash: action.hash,
      why: action.why,
    });
  }

  const count = (kind: Outcome) => actions.filter((a) => a.kind === kind).length;

  return {
    scanned: actions.length,
    finalized: count("finalized"),
    refunded: count("refunded"),
    held: count("held"),
    failed: count("failed"),
    actions,
  };
}

export { GRACE_MS as RECONCILE_GRACE_MS };
