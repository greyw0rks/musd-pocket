import type { Metadata } from "next";
import Link from "next/link";
import "@/components/pocket/pocket.css";
import { renderReceiptEmail, type ReceiptEmailInput } from "@/lib/email/receipt";
import { explorer } from "@/lib/mezo/explorer";

/**
 * The receipt, as it lands in a mailbox.
 *
 * This page is a preview, not a picture: each frame below is the real HTML the
 * delivery helper sends, rendered from the same function the payment route
 * will call. Nothing here is a mock-up that can drift from what ships.
 *
 * Open at `/brand/email`, next to `/brand`, when changing anything about the
 * receipt.
 */

export const metadata: Metadata = {
  title: "Pocket — Email receipts",
  description:
    "Every Pocket receipt email, rendered from the brand kit's own tokens.",
};

const TX_HASH =
  "0x7f3a9c2e1b4d8a6f0c5e9b2d7a4f1c8e3b6d9a2f5c8e1b4d7a0f3c6e9b2d5a8f";

const AT = new Date("2026-10-20T14:32:00Z");

/**
 * One sample per kind, filled so the preview shows the shape each kind really
 * takes: a sent payment names a person, a withdrawal names an address, a loan
 * names the protocol and its collateral, and a close has no amount at all.
 */
function sample(
  kind: ReceiptEmailInput["kind"],
  status: ReceiptEmailInput["status"] = "confirmed",
): ReceiptEmailInput {
  const base = {
    kind,
    status,
    at: AT,
    reference: TX_HASH,
    explorerUrl: explorer.tx(TX_HASH),
    appUrl: "https://mpocket.tech",
    network: "Mezo",
  };

  switch (kind) {
    case "sent":
      return {
        ...base,
        amount: "$12.00",
        counterparty: "@sarah",
        counterpartyAddress: "0x4e2a8c1f6b9d3a7e0c5f8b2d4a6e9c1f3b7d0a5e",
        details: [{ label: "From", value: "@musd_pocket" }],
        note: "Dinner, split three ways.",
      };
    case "received":
      return {
        ...base,
        amount: "$12.00",
        counterparty: "@musd_pocket",
        counterpartyAddress: "0x7c1d9a4e2f6b8c0d3a5e7f1b9d4c6a8e0f2b5d7c",
        details: [{ label: "To", value: "@sarah" }],
        note: "Dinner, split three ways.",
      };
    case "withdrawal":
      return {
        ...base,
        amount: "0.005 BTC",
        counterparty: "0x4e2a…0a5e",
        counterpartyAddress: "0x4e2a8c1f6b9d3a7e0c5f8b2d4a6e9c1f3b7d0a5e",
        details: [{ label: "From", value: "@musd_pocket" }],
      };
    case "borrow":
      return {
        ...base,
        amount: "$2,500.00",
        counterparty: "Mezo Borrow",
        details: [
          { label: "Borrowing into", value: "@musd_pocket" },
          { label: "Collateral", value: "0.052 BTC" },
        ],
      };
    case "repay":
      return {
        ...base,
        amount: "$420.00",
        counterparty: "Mezo Borrow",
        details: [{ label: "Repaying from", value: "@musd_pocket" }],
      };
    case "close":
      return {
        ...base,
        details: [{ label: "Borrower", value: "@musd_pocket" }],
      };
  }
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="pk-h1 mt-0">{title}</h2>
      {note ? (
        <p className="pk-m max-w-[62ch]" style={{ lineHeight: 1.6 }}>
          {note}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Frame({
  title,
  html,
  width = 375,
  height = 900,
}: {
  title: string;
  html: string;
  width?: number;
  height?: number;
}) {
  return (
    <div
      className="pk-card"
      style={{ padding: 12, maxWidth: "100%", overflowX: "auto" }}
    >
      <iframe
        title={title}
        srcDoc={html}
        width={width}
        height={height}
        style={{
          display: "block",
          width: "100%",
          maxWidth: width,
          height,
          border: 0,
          borderRadius: 16,
          background: "#f4f4f6",
        }}
      />
    </div>
  );
}

const STATES: {
  status: ReceiptEmailInput["status"];
  title: string;
  note: string;
}[] = [
  {
    status: "confirmed",
    title: "Confirmed",
    note: "The one that is actually sent: the transfer is verified on Mezo.",
  },
  {
    status: "pending",
    title: "Pending",
    note: "Filed but not yet confirmed. Same template, quieter claim.",
  },
  {
    status: "failed",
    title: "Failed",
    note: "The transfer did not land. The receipt says so plainly.",
  },
];

const KINDS: {
  kind: ReceiptEmailInput["kind"];
  title: string;
  note: string;
}[] = [
  {
    kind: "sent",
    title: "Sent",
    note: "A payment out: the recipient and their address, the payer, the amount.",
  },
  {
    kind: "received",
    title: "Received",
    note: "The other party's copy of the same payment. One document each, not one document twice.",
  },
  {
    kind: "withdrawal",
    title: "Withdrawal",
    note: "Native BTC to an address. The unit is the amount — no dollar sign in sight.",
  },
  {
    kind: "borrow",
    title: "Borrowed",
    note: "A Trove opened. The MUSD drawn is the amount; the BTC locked is named beneath it.",
  },
  {
    kind: "repay",
    title: "Repaid",
    note: "A repayment against the same Trove. Same shell, opposite direction.",
  },
  {
    kind: "close",
    title: "Closed",
    note: "A Trove closed. No amount, because no money moves — the sentence is the receipt.",
  },
];

export default function EmailBrandPage() {
  const confirmed = renderReceiptEmail(sample("sent"));

  return (
    <div
      className="pocket-root"
      data-theme="light"
      style={{ minHeight: "100svh", background: "var(--bg)" }}
    >
      <div className="mx-auto w-full max-w-[1080px] px-6 pb-20 pt-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="pk-m" style={{ letterSpacing: "0.14em" }}>
              POCKET / BRAND / EMAIL
            </p>
            <h1
              className="mt-2"
              style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.2 }}
            >
              Email receipts
              <span style={{ color: "var(--p)" }}>.</span>
            </h1>
            <p
              className="mt-3 max-w-[56ch] text-[15px]"
              style={{ color: "var(--m)", lineHeight: 1.6 }}
            >
              Every money movement sends one — a payment in either direction, a
              BTC withdrawal, and a loan opened, repaid or closed. They share
              one template that is built from the same tokens as the app — the
              yellow money card is the receipt&rsquo;s one brand gesture — and
              rendered by the same function that delivers it, so this page
              cannot describe a receipt the product does not send.
            </p>
          </div>

          <Link href="/brand" className="pk-chip">
            Back to brand kit
          </Link>
        </header>

        <Section
          title="The receipt"
          note="600px on a desktop client, fluid below 620px. Poppins, with the app's system fallback; the mark is the same /icon PNG the installed app uses. Only the confirmed state is mailed — the other two are here so the template is complete."
        >
          <div className="mx-auto w-full max-w-[624px]">
            <Frame
              title="Confirmed receipt email"
              html={confirmed.html}
              width={600}
              height={940}
            />
          </div>
        </Section>

        <Section
          title="The six receipts"
          note="One template, six events. The heading, the sentence under the amount, the preposition and the closing line change; the shell does not. A kind that moves no money — a close — drops the amount block rather than printing a zero."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {KINDS.map((entry) => {
              const rendered = renderReceiptEmail(sample(entry.kind));
              return (
                <div key={entry.kind}>
                  <Frame
                    title={`${entry.title} receipt email`}
                    html={rendered.html}
                    width={375}
                    height={960}
                  />
                  <p className="pk-m mt-3" style={{ lineHeight: 1.5 }}>
                    <b className="text-[var(--t)]">{entry.title}</b> —{" "}
                    {entry.note}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="States"
          note="One template, three claims. The money card stays yellow in dark mode as well: it is an object, not a surface."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {STATES.map((state) => {
              const rendered = renderReceiptEmail(sample("sent", state.status));
              return (
                <div key={state.status}>
                  <Frame
                    title={`${state.title} receipt email`}
                    html={rendered.html}
                    width={375}
                    height={960}
                  />
                  <p className="pk-m mt-3" style={{ lineHeight: 1.5 }}>
                    <b className="text-[var(--t)]">{state.title}</b> — {state.note}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="The envelope"
          note="What the inbox shows before the receipt is opened, plus the fixed facts of delivery."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="pk-card">
              <h3 className="pk-h2">Message</h3>
              <dl className="mt-3 space-y-3 text-[14px]">
                <div>
                  <dt className="pk-m">From</dt>
                  <dd className="font-semibold">receipts@mpocket.tech</dd>
                </div>
                <div>
                  <dt className="pk-m">Subject</dt>
                  <dd className="font-semibold">{confirmed.subject}</dd>
                </div>
                <div>
                  <dt className="pk-m">Preheader</dt>
                  <dd className="font-semibold">{confirmed.preheader}</dd>
                </div>
                <div>
                  <dt className="pk-m">Reply-to</dt>
                  <dd className="pk-m">
                    Unset by default; configure RECEIPT_REPLY_TO when a mailbox
                    is monitored.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="pk-card">
              <h3 className="pk-h2">Material</h3>
              <div className="mt-3 space-y-3 text-[14px]">
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      background: "#ffc83d",
                      flex: "none",
                    }}
                  />
                  <span>
                    <b>#ffc83d</b>{" "}
                    <span className="pk-m">— the money card, both themes</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      background: "#16a34a",
                      flex: "none",
                    }}
                  />
                  <span>
                    <b>#16a34a</b>{" "}
                    <span className="pk-m">— the confirmation disc</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      background: "#a63fd9",
                      flex: "none",
                    }}
                  />
                  <span>
                    <b>#a63fd9</b>{" "}
                    <span className="pk-m">— the wordmark&rsquo;s dot</span>
                  </span>
                </div>
                <p className="pk-m" style={{ lineHeight: 1.5 }}>
                  Type: Poppins 500 / 600 / 700, falling back to the system
                  stack where a client blocks web fonts. The amount is the
                  largest thing in the message.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Plain text"
          note="Sent alongside the HTML. Some clients show it; some filters prefer it. It carries every fact the HTML does, including the full reference."
        >
          <div className="pk-card" style={{ padding: 0, overflow: "hidden" }}>
            <pre
              className="pk-m"
              style={{
                margin: 0,
                padding: 20,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                lineHeight: 1.7,
                color: "var(--t)",
              }}
            >
              {confirmed.text}
            </pre>
          </div>
        </Section>

        <Section
          title="Sending"
          note="The helper lives in lib/email. It posts to Resend with a server-only key; with no key it logs and does nothing. Nothing on the payment route awaits it."
        >
          <div className="pk-card">
            <p className="text-[14px]" style={{ lineHeight: 1.7 }}>
              <b>Env:</b>{" "}
              <code className="pk-m">RESEND_API_KEY</code> (required to deliver),{" "}
              <code className="pk-m">RECEIPT_FROM_EMAIL</code> (defaults to{" "}
              <code className="pk-m">Pocket &lt;receipts@mpocket.tech&gt;</code>
              ), and optional{" "}
              <code className="pk-m">RECEIPT_REPLY_TO</code>.
            </p>
            <p className="pk-m mt-3" style={{ lineHeight: 1.6 }}>
              The destination comes from the address a user attaches in
              Profile → Receipts. It is stored on the user row
              (<code className="pk-m">users.receiptsEmail</code>), never
              inferred from a sign-in, and no address means no mail. It is sent
              only from a route that has re-read the chain:{" "}
              <code className="pk-m">POST /api/payments/record</code> (both
              parties), <code className="pk-m">POST /api/withdrawals/native</code>{" "}
              and <code className="pk-m">POST /api/borrow/record</code>.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
