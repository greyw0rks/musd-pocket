import type { NextRequest } from "next/server";
import { getAddress } from "viem";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { getBorrowPosition, type BorrowPosition } from "@/lib/mezo/borrow";

/**
 * GET /api/borrow — the signed-in user's Mezo Borrow position (their Trove),
 * read-only.
 *
 * The borrower is the user's own embedded wallet, taken from the verified
 * session rather than from the request: a caller must not be able to ask about
 * somebody else's Trove, and the identity is the only place that is settled.
 * No body, no writes, nothing signed — the route exists so the client does not
 * have to hold an RPC URL, and so the price-oracle read happens server-side
 * where it can be retried.
 *
 * Bigints are stringified for JSON transport: these are 18-decimal wei and
 * would be silently rounded as JSON numbers.
 */
export async function GET(req: NextRequest) {
  try {
    const identity = await requireIdentity(req);
    const position = await getBorrowPosition(getAddress(identity.walletAddress));
    return Response.json({ borrow: serializeBorrow(position) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** bigint → decimal string (18-dp wei preserved); null stays null. */
function serializeBorrow(p: BorrowPosition) {
  const s = (v: bigint | null) => (v === null ? null : v.toString());
  return {
    hasTrove: p.hasTrove,
    status: p.status,
    statusLabel: p.statusLabel,
    collateral: p.collateral.toString(),
    debt: p.debt.toString(),
    price: s(p.price),
    mcr: p.mcr.toString(),
    collateralRatio: s(p.collateralRatio),
    ltv: s(p.ltv),
    liquidationPrice: s(p.liquidationPrice),
    health: p.health,
  };
}

export type SerializedBorrow = ReturnType<typeof serializeBorrow>;
