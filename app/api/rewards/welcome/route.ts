import type { NextRequest } from "next/server";
import { AuthError, errorResponse, requireIdentity } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { welcomeRewardStatus } from "@/lib/rewards/service";

export const maxDuration = 60;

async function verifiedUser(req: NextRequest) {
  const identity = await requireIdentity(req);
  const user = await getUserByWallet(identity.walletAddress);
  if (!user) throw new AuthError("User not found — sync first", 404);
  return identity;
}

export async function GET(req: NextRequest) {
  try {
    const status = await welcomeRewardStatus(
      await verifiedUser(req),
      req.nextUrl.searchParams.get("txHash"),
    );
    return Response.json(
      status.state === "claimed" || status.state === "wallet-claimed" || status.pendingTxHash
        ? status
        : { ...status, state: "unavailable", reason: "The welcome reward has ended. Use the testnet faucet to get started." },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  // Older APKs must not request a new server-funded lock after retirement.
  // GET remains available for recovery of historical claims.
  return Response.json(
    { error: "The welcome reward has ended. Use the testnet faucet to get started." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } },
  );
}
