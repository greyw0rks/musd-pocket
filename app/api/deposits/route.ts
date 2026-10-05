import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireIdentity, errorResponse, AuthError } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { findVaultDeposits } from "@/lib/mezo/deposits";
import { getVaultAddress, hasVault } from "@/lib/mezo/vault";
import { formatMusd } from "@/lib/mezo/musd";
import { MUSD_ADDRESS } from "@/lib/mezo/config";
import { creditAvailable, ledgerTx } from "@/lib/ledger/service";
import { prisma } from "@/lib/db";

/**
 * Deposits — fund a Pocket balance by sending MUSD to the vault.
 *
 * GET  /api/deposits — the caller's deposit history.
 * POST /api/deposits — scan the vault for inbound MUSD transfers FROM the
 *   caller's own embedded wallet and credit any not already recorded. Attribution
 *   by sender is the trust-minimised rule: you can only credit MUSD you yourself
 *   sent to the vault. Idempotent via Deposit.txHash @unique — re-scanning an
 *   overlapping block range never double-credits.
 */

export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    const deposits = await prisma.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json({
      deposits: deposits.map((d) => ({
        id: d.id,
        amount: d.amount.toString(),
        chain: d.chain,
        txHash: d.txHash,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    if (!hasVault()) {
      return Response.json({ error: "Vault not configured" }, { status: 503 });
    }
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    const vault = getVaultAddress().toLowerCase();
    const token = MUSD_ADDRESS.toLowerCase();
    const onchain = await findVaultDeposits({ from: user.walletAddress });

    let credited = 0;
    let creditedAmount = 0;

    for (const d of onchain) {
      const amount = formatMusd(d.value);
      try {
        await ledgerTx(async (tx) => {
          // Deposit.txHash @unique: throws P2002 if this transfer is already recorded,
          // rolling back the whole tx so the credit can't double-apply.
          await tx.deposit.create({
            data: {
              userId: user.id,
              chain: "MEZO",
              amount,
              txHash: d.txHash,
              vaultAddress: vault,
              status: "COMPLETED",
            },
          });
          await creditAvailable(tx, user.id, amount);
          await tx.transaction.create({
            data: {
              type: "DEPOSIT",
              userId: user.id,
              counterparty: "Pocket vault",
              amount,
              token,
              sourceChain: "MEZO",
              destChain: "MEZO",
              status: "COMPLETED",
              txHash: d.txHash,
            },
          });
        });
        credited++;
        creditedAmount += Number(amount);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue; // already credited — idempotent skip
        }
        throw e;
      }
    }

    const fresh = await getUserByWallet(identity.walletAddress);
    return Response.json({
      credited,
      amount: creditedAmount.toString(),
      availableBalance: (fresh ?? user).availableBalance.toString(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
