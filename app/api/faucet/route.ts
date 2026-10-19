import type { NextRequest } from "next/server";
import {
  AuthError,
  errorResponse,
  requireIdentity,
} from "@/lib/auth/request";
import {
  claimFaucet,
  faucetAmounts,
  faucetEnabled,
  faucetStatus,
} from "@/lib/faucet";
import { getUserByWallet } from "@/lib/users/service";

/**
 * GET  /api/faucet — whether this account has used its claim, and whether the
 *                    funding wallet can cover the next one.
 * POST /api/faucet — send the claim to the caller's own wallet.
 *
 * The recipient is never read from the request. A faucet that pays any address
 * an authenticated caller names is a faucet with a public drain; the verified
 * Privy wallet is the only destination this route knows.
 *
 * `maxDuration` covers the confirmation wait (two receipts, in parallel, 25s).
 * The claim itself is resumable, so a function killed at the limit does not
 * lose the money — the next attempt picks up the leg that is missing.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    // Mainnet has no faucet. Answering `enabled: false` lets the client hide
    // the icon without a 404 in the console.
    if (!faucetEnabled()) {
      return Response.json({
        enabled: false,
        claimed: false,
        pending: false,
        funded: null,
        claim: null,
        amounts: faucetAmounts(),
      });
    }

    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    return Response.json(await faucetStatus(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!faucetEnabled()) {
      return Response.json(
        { error: "The faucet is only available on testnet." },
        { status: 404 },
      );
    }

    const identity = await requireIdentity(req);
    const user = await getUserByWallet(identity.walletAddress);
    if (!user) throw new AuthError("User not found — sync first", 404);

    return Response.json(await claimFaucet(user));
  } catch (error) {
    return errorResponse(error);
  }
}
