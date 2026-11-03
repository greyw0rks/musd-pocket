import type { NextRequest } from "next/server";
import { AuthError, errorResponse, requireIdentity } from "@/lib/auth/request";
import { getUserByWallet } from "@/lib/users/service";
import { claimWelcomeReward, welcomeRewardStatus } from "@/lib/rewards/service";

export const maxDuration = 60;

async function verifiedUser(req: NextRequest) {
  const identity = await requireIdentity(req);
  const user = await getUserByWallet(identity.walletAddress);
  if (!user) throw new AuthError("User not found — sync first", 404);
  return identity;
}

export async function GET(req: NextRequest) {
  try {
    return Response.json(
      await welcomeRewardStatus(
        await verifiedUser(req),
        req.nextUrl.searchParams.get("txHash"),
      ),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // No amount, address, account ID, or signature comes from the request body.
    const status = await claimWelcomeReward(await verifiedUser(req));
    return Response.json(status, {
      status: status.pendingTxHash ? 202 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
