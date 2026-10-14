import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { hasVault } from "@/lib/mezo/vault";
import { RECONCILE_GRACE_MS, reconcile } from "@/lib/settlement/reconcile";

/**
 * POST-free reconciliation entry point for the scheduler.
 *
 * This route is reachable from the internet, so the secret is the only thing
 * standing between a stranger and a function that moves balances. It fails
 * closed when `CRON_SECRET` is unset — an unauthenticated deployment gets a 401,
 * never an open money-moving endpoint.
 *
 * GET is what Vercel Cron sends. Nothing here is idempotency-sensitive at the
 * HTTP layer: a repeated call is safe because every ledger mutation underneath
 * is gated on a status transition that only succeeds once.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Constant-time comparison. Both sides are hashed first because
 * `timingSafeEqual` throws on inputs of different lengths — comparing raw
 * strings would leak the secret's length through that throw, and short-circuit
 * on the first differing byte would leak its prefix.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer (.+)$/i.exec(header);
  if (!match) return false;
  return constantTimeEquals(match[1], secret);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Without the vault there is no chain truth to read, so every row would hold
  // forever and the run would be pure noise. Say so instead of churning.
  if (!hasVault()) {
    return Response.json(
      { error: "Vault not configured (NEXT_PUBLIC_POCKET_VAULT_ADDRESS)" },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  try {
    const report = await reconcile();
    return Response.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      graceMs: RECONCILE_GRACE_MS,
      scanned: report.scanned,
      finalized: report.finalized,
      refunded: report.refunded,
      held: report.held,
      failed: report.failed,
      actions: report.actions,
    });
  } catch (err) {
    // Never leak the error itself — it can carry RPC URLs and connection
    // strings. The stack stays in the logs.
    console.error("[cron/reconcile] run failed", { error: String(err) });
    return Response.json({ error: "Reconciliation run failed" }, { status: 500 });
  }
}
