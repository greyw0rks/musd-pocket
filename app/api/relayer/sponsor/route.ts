import { NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { requireIdentity, errorResponse } from "@/lib/auth/request";
import { hasRelayer, relayerSendMusd } from "@/lib/relayer";

/**
 * Spike endpoint (DEV-ONLY): ask the BTC-funded relayer to deliver MUSD to a
 * recipient, proving the recipient needs no BTC for gas (gasless receive).
 *
 * This moves funds straight out of the relayer hot wallet, so it is locked down:
 *  - 404 in production — it must never exist in a deployed build.
 *  - requires a valid Privy identity (no anonymous calls).
 *  - caps the per-call amount so even an authed caller can't drain the wallet.
 * The real money paths are /api/payments and /api/withdrawals (vault-mediated);
 * this stays only as a dev harness for the Phase-0 gasless-receive proof.
 */
const MAX_SPONSOR_MUSD = 5;

const schema = z.object({
  to: z.string().refine(isAddress, "Invalid EVM address"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,18})?$/, "Invalid amount")
    .refine((a) => Number(a) > 0 && Number(a) <= MAX_SPONSOR_MUSD, {
      message: `Amount must be between 0 and ${MAX_SPONSOR_MUSD} mUSD`,
    }),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Authenticated callers only — this endpoint spends the relayer hot wallet.
  try {
    await requireIdentity(request);
  } catch (e) {
    return errorResponse(e);
  }

  if (!hasRelayer()) {
    return NextResponse.json(
      { error: "Relayer not configured — set RELAYER_PRIVATE_KEY in .env" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { hash, relayer } = await relayerSendMusd(
      parsed.data.to,
      parsed.data.amount,
    );
    return NextResponse.json({ ok: true, txHash: hash, relayer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Relayer send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
