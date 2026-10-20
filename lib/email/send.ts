/**
 * Delivering a receipt.
 *
 * Resend's REST API is used directly rather than through its SDK: the request
 * is three fields and a bearer token, and a dependency that wraps a POST would
 * be a dependency to keep in step for no gain. The key stays server-side.
 *
 * Delivery is deliberately *not* on the action's path. A receipt is a record,
 * not the payment: by the time this is called the money has already moved, so
 * a mail provider outage must never turn a completed transfer, withdrawal or
 * borrow into a failed one. Every route schedules the send with `after()` —
 * after the response — and `sendReceipt` returns a result instead of throwing
 * at that boundary.
 *
 * With no key configured the send is a no-op that says so. That keeps local
 * development and preview deployments honest instead of pretending mail was
 * sent, and it means the feature can ship before the domain's DNS records do.
 */

import "server-only";
import { renderReceiptEmail, type ReceiptEmailInput } from "./receipt";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReceiptSendResult =
  | { sent: true; id: string }
  | {
      sent: false;
      reason: "not_configured" | "invalid_address" | "provider_error";
      detail?: string;
    };

/** The From line. `receipts@mpocket.tech` is the product's one receipt address. */
export function receiptsFromAddress(): string {
  return (
    process.env.RECEIPT_FROM_EMAIL?.trim() ||
    "Pocket <receipts@mpocket.tech>"
  );
}

export function isReceiptEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Send one receipt.
 *
 * Returns a result instead of throwing so the caller can decide what a failure
 * means. Routes run this inside `after()`, where the answer only reaches a log.
 */
export async function sendReceipt(
  to: string,
  input: ReceiptEmailInput,
): Promise<ReceiptSendResult> {
  const address = to.trim();
  if (!EMAIL_PATTERN.test(address)) {
    return { sent: false, reason: "invalid_address" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[receipt] RESEND_API_KEY is not set; receipt not sent", {
      to: address,
    });
    return { sent: false, reason: "not_configured" };
  }

  const { subject, html, text } = renderReceiptEmail(input);

  const replyTo = process.env.RECEIPT_REPLY_TO?.trim();

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: receiptsFromAddress(),
        to: [address],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      // A mailbox provider is not part of the payment's critical path, but a
      // hung request should still not hold a function open indefinitely.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 500);
      console.error("[receipt] provider rejected the message", {
        status: response.status,
        detail,
      });
      return { sent: false, reason: "provider_error", detail };
    }

    const body = (await response.json().catch(() => ({}))) as { id?: unknown };
    return {
      sent: true,
      id: typeof body.id === "string" ? body.id : "unknown",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[receipt] delivery failed", { error: detail });
    return { sent: false, reason: "provider_error", detail };
  }
}
