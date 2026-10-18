import type { NextRequest } from "next/server";
import { getAddress } from "viem";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import {
  getEarnPosition,
  vaultAcceptsMusd,
  type EarnPosition,
} from "@/lib/mezo/earn";

/**
 * GET /api/earn — the signed-in user's Mezo Savings Vault position, read-only.
 *
 * The holder is the user's own embedded wallet, taken from the verified session
 * rather than from the request. That is not only a privacy rule here, it is the
 * whole custody story: the vault credits whoever calls `deposit`, so the only
 * address whose position is meaningful is the one the session proves the user
 * holds. Answering about an address the caller named would be answering about
 * somebody else's savings.
 *
 * Bigints are stringified for JSON transport: these are 18-decimal wei and
 * would be silently rounded as JSON numbers.
 *
 * No writes, nothing signed. The deposit and withdrawal transactions are built
 * and signed in the browser (`lib/mezo/earn-actions.ts`) because they must be
 * signed by the user's own wallet — a server route that could move money into
 * or out of a savings position would be a server that can spend it.
 */
export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const owner = getAddress(identity.walletAddress);

    const [position, acceptsMusd] = await Promise.all([
      getEarnPosition(owner),
      /*
        Contained on purpose. This read guards a deposit rather than describing
        the position, so if it will not answer the screen should still show the
        balance — `null` means "not established", which is not the same as the
        mismatch `false` reports and must not be rendered as one.
      */
      vaultAcceptsMusd().catch(() => null),
    ]);

    return Response.json({ earn: serializeEarn(position, acceptsMusd) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** bigint → decimal string (18-dp wei preserved); null stays null. */
function serializeEarn(p: EarnPosition, acceptsMusd: boolean | null) {
  const s = (v: bigint | null) => (v === null ? null : v.toString());
  return {
    /*
      `shares` and `principal` are the same figure and both are sent, because
      they are the same figure *by fact* rather than by arithmetic — see the
      note in `lib/mezo/earn.ts`, where a decoded deposit event shows the vault
      minting one sMUSD per MUSD. Sending one number under two names is what
      keeps a future reader from introducing a conversion between them.
    */
    shares: p.shares.toString(),
    principal: p.principal.toString(),
    totalShares: p.totalShares.toString(),
    hasPosition: p.hasPosition,
    /* `null` is "the vault did not answer", which the screen withholds. */
    claimableYield: s(p.claimableYield),
    vaultAcceptsMusd: acceptsMusd,
  };
}

export type SerializedEarn = ReturnType<typeof serializeEarn>;
