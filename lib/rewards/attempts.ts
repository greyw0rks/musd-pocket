import "server-only";
import { prisma } from "@/lib/db";

export function attemptId(chainId: number, campaign: string, claimId: string) {
  return `${chainId}:${campaign.toLowerCase()}:${claimId.toLowerCase()}`;
}

export function readAttempt(id: string) {
  return prisma.welcomeRewardAttempt.findUnique({ where: { id } });
}

/** Unique account and wallet reservations also coordinate different servers. */
export async function reserveAttempt(input: {
  id: string;
  chainId: number;
  campaign: string;
  claimId: string;
  walletAddress: string;
}) {
  try {
    await prisma.welcomeRewardAttempt.create({
      data: {
        ...input,
        campaign: input.campaign.toLowerCase(),
        walletAddress: input.walletAddress.toLowerCase(),
      },
    });
    return true;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2002"
    )
      throw error;
    // A retry is allowed only after a verified on-chain revert or pre-sign failure.
    const result = await prisma.welcomeRewardAttempt.updateMany({
      where: {
        id: input.id,
        walletAddress: input.walletAddress.toLowerCase(),
        state: "RETRYABLE",
      },
      data: { state: "SENDING", txHash: null },
    });
    return result.count === 1;
  }
}

export async function recordBroadcast(id: string, txHash: string) {
  await prisma.welcomeRewardAttempt.update({
    where: { id },
    data: { state: "BROADCAST", txHash },
  });
}

export async function allowRetry(id: string, txHash: string) {
  await prisma.welcomeRewardAttempt.updateMany({
    where: { id, txHash, state: "BROADCAST" },
    data: { state: "RETRYABLE" },
  });
}
