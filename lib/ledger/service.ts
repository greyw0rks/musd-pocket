import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Ledger — transactional available/frozen balance mutations. The ledger is an
 * INDEXED VIEW of on-chain state, not the source of truth: deposits credit
 * available when the vault receives MUSD; a send freezes available until the
 * destination payout lands, then the frozen amount is released (it has left the
 * system). All mutations are atomic, guarded `updateMany`s — a balance can never
 * go negative because the WHERE clause refuses the update and we see count === 0.
 *
 * Each primitive takes a Prisma.TransactionClient so callers compose several
 * (e.g. "create Payment + freeze") into one $transaction. Use `ledgerTx` to open
 * one.
 */

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

type Tx = Prisma.TransactionClient;

function dec(amount: string | number): Prisma.Decimal {
  return new Prisma.Decimal(amount);
}

/** Credit available balance (deposit confirmed, or inbound receive). */
export async function creditAvailable(tx: Tx, userId: string, amount: string) {
  await tx.user.update({
    where: { id: userId },
    data: { availableBalance: { increment: dec(amount) } },
  });
}

/** Move available → frozen for an in-flight send. Refuses to overdraw. */
export async function freezeForSend(tx: Tx, userId: string, amount: string) {
  const amt = dec(amount);
  const res = await tx.user.updateMany({
    where: { id: userId, availableBalance: { gte: amt } },
    data: {
      availableBalance: { decrement: amt },
      frozenBalance: { increment: amt },
    },
  });
  if (res.count === 0) throw new LedgerError("Insufficient available balance");
}

/** Frozen funds have been paid out — drop them from the ledger. */
export async function releaseFrozen(tx: Tx, userId: string, amount: string) {
  const amt = dec(amount);
  const res = await tx.user.updateMany({
    where: { id: userId, frozenBalance: { gte: amt } },
    data: { frozenBalance: { decrement: amt } },
  });
  if (res.count === 0) throw new LedgerError("Frozen balance underflow");
}

/** A send failed before payout — return frozen funds to available. */
export async function refundToAvailable(tx: Tx, userId: string, amount: string) {
  const amt = dec(amount);
  const res = await tx.user.updateMany({
    where: { id: userId, frozenBalance: { gte: amt } },
    data: {
      frozenBalance: { decrement: amt },
      availableBalance: { increment: amt },
    },
  });
  if (res.count === 0) throw new LedgerError("Frozen balance underflow");
}

/** Debit available directly (withdrawal to an external address). Refuses to overdraw. */
export async function debitAvailable(tx: Tx, userId: string, amount: string) {
  const amt = dec(amount);
  const res = await tx.user.updateMany({
    where: { id: userId, availableBalance: { gte: amt } },
    data: { availableBalance: { decrement: amt } },
  });
  if (res.count === 0) throw new LedgerError("Insufficient available balance");
}

/** Open a ledger transaction so several primitives commit atomically. */
export function ledgerTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
