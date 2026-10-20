/**
 * The receipt email.
 *
 * One template for every receipt Pocket sends: a payment that left the wallet,
 * a payment that arrived, a BTC withdrawal, and the three Mezo Borrow events
 * (opening a loan, repaying part of it, closing it). The *kind* changes the
 * sentence, the preposition and the footer; the envelope, the money card and
 * the record below it are the same object every time. A second template would
 * be a second thing to keep in brand, and the mailbox would drift first.
 *
 * The design is rendered from the same tokens the app renders from. This is
 * deliberately *not* a second design system: the palette, the type stack, the
 * radii and the wordmark all come from `lib/brand/tokens.ts`, so a change to
 * the product's colours lands here in the same commit instead of leaving the
 * mailbox a version behind.
 *
 * The medium forces three departures from the app, and only three:
 *
 *  1. Layout is tables, not flexbox. Outlook renders email with Word, which
 *     knows almost nothing about CSS layout. Every positioning decision below
 *     is a nested `<table role="presentation">`; nothing depends on `flex`.
 *  2. The mark is an image. Satori draws the in-app mark with divs, which mail
 *     clients cannot reproduce, so the header points at the PNG the app already
 *     serves at `/icon` (the same drawing, rendered by the same component).
 *  3. The receipt's money card is the highlight yellow, not the surface white.
 *     On a screen the receipt is a page; in a mailbox it is an object, and the
 *     yellow card is the brand's own way of saying "this is money". It stays
 *     yellow in dark mode for the same reason the home-screen icon keeps its
 *     ground: an object does not invert with the page behind it.
 *
 * Everything user-supplied is escaped. Handles, addresses, notes and the detail
 * values all arrive from a database or from decoded chain data and are rendered
 * into HTML, so a note that contains `<` must be text, not markup.
 */

import { palette, type as typeTokens } from "@/lib/brand/tokens";

export type ReceiptKind =
  | "sent"
  | "received"
  | "withdrawal"
  | "borrow"
  | "repay"
  | "close";

export type ReceiptEmailStatus = "confirmed" | "pending" | "failed";

/** One fact in the record card: label left, value right. */
export interface ReceiptDetail {
  label: string;
  value: string;
}

export interface ReceiptEmailInput {
  /** What happened. Selects the sentence, not the design. */
  kind: ReceiptKind;
  /**
   * Pre-formatted, with its own token marker: "$12.00" or "0.005 BTC".
   * Absent only for a close, which has no single figure to headline.
   */
  amount?: string | null;
  /** The other side: a handle, an address, or "Mezo Borrow". */
  counterparty?: string | null;
  /** Their wallet, when it is worth showing under the counterparty. */
  counterpartyAddress?: string | null;
  /** Extra rows between the counterparty and the date, in reading order. */
  details?: ReceiptDetail[];
  note?: string | null;
  status: ReceiptEmailStatus;
  /** When the thing happened. */
  at: Date;
  /** The transaction hash this receipt describes. */
  reference: string;
  explorerUrl?: string | null;
  /** Where "Open Pocket" points. No trailing slash. */
  appUrl?: string;
  network?: string;
  /** IANA zone. Defaults to UTC because the server does not know the reader's. */
  timezone?: string;
  /** Absolute URL of the Pocket mark. */
  logoUrl?: string;
}

export interface RenderedReceiptEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const L = palette.light;
const D = palette.dark;
const FONT = typeTokens.stack;

/** The yellow money card is one fixed object in both themes. */
const YELLOW = L.y;
const ON_YELLOW = L.t;
const ON_YELLOW_MUTED = "rgba(11, 11, 13, 0.64)";

const LINE_LIGHT = "rgba(11, 11, 13, 0.08)";
const LINE_DARK = "rgba(255, 255, 255, 0.14)";

/**
 * The warn pill's ink, mixed exactly like `pk-pill--warn` in `pocket.css`:
 * 55% of the highlight over the theme's text colour. Yellow cannot be read as
 * text, which is why it is mixed down rather than used directly.
 */
const WARN_INK_LIGHT = "#917327";
const WARN_INK_DARK = "#ffe094";

const STATUS: Record<
  ReceiptEmailStatus,
  {
    heading: string;
    label: string;
    subjectLead: string;
    preheader: string;
    disc: string;
    glyph: string;
    pillBg: string;
    pillInk: string;
    pillInkDark: string;
  }
> = {
  confirmed: {
    heading: "", // selected by kind — every kind has its own past-tense heading
    label: "",
    subjectLead: "",
    preheader: "",
    disc: L.g,
    glyph: "&#10003;", // ✓
    pillBg: "rgba(255, 255, 255, 0.72)",
    pillInk: L.gInk,
    pillInkDark: L.gInk,
  },
  pending: {
    heading: "Sending&hellip;",
    label: "Waiting for confirmation",
    subjectLead: "Sending",
    preheader: "Waiting for the chain to confirm",
    disc: L.inv,
    glyph: "&hellip;", // …
    pillBg: "rgba(255, 255, 255, 0.72)",
    pillInk: WARN_INK_LIGHT,
    pillInkDark: WARN_INK_LIGHT,
  },
  failed: {
    heading: "Not sent",
    label: "Nothing left your wallet",
    subjectLead: "Not sent",
    preheader: "Nothing left your wallet",
    disc: L.r,
    glyph: "&#10005;", // ✕
    pillBg: "rgba(255, 255, 255, 0.72)",
    pillInk: L.rInk,
    pillInkDark: L.rInk,
  },
};

interface KindCopy {
  /** The big line inside the money card, for a confirmed event. */
  heading: string;
  /** The inbox subject. Receives the values already formatted. */
  subject: (amount: string, counterparty: string) => string;
  /** How the hero names the counterparty — or null when there is none. */
  preposition: "to" | "from" | null;
  /** What the small print says this document is. */
  footer: string;
}

/**
 * The words. The one place a kind differs, kept together so the six receipts
 * cannot describe themselves in six tones.
 */
const KINDS: Record<ReceiptKind, KindCopy> = {
  sent: {
    heading: "Sent!",
    subject: (amount, to) => `Your receipt — ${amount} to ${to}`,
    preposition: "to",
    footer:
      "This is a receipt for a payment made with Pocket. Keep it for your records.",
  },
  received: {
    heading: "Received!",
    subject: (amount, from) => `You received ${amount} from ${from}`,
    preposition: "from",
    footer:
      "This is a receipt for a payment received with Pocket. Keep it for your records.",
  },
  withdrawal: {
    heading: "Withdrawn!",
    subject: (amount, to) => `Your withdrawal — ${amount} to ${to}`,
    preposition: "to",
    footer:
      "This is a receipt for a withdrawal made with Pocket. Keep it for your records.",
  },
  borrow: {
    heading: "Borrowed!",
    subject: (amount, from) => `Your loan — ${amount} from ${from}`,
    preposition: "from",
    footer:
      "This is a receipt for a loan opened with Mezo Borrow through Pocket. Keep it for your records.",
  },
  repay: {
    heading: "Repaid!",
    subject: (amount, to) => `Your repayment — ${amount} to ${to}`,
    preposition: "to",
    footer:
      "This is a receipt for a loan repayment made through Pocket. Keep it for your records.",
  },
  close: {
    heading: "Closed!",
    subject: () => "Your loan is closed",
    preposition: null,
    footer:
      "This is a receipt confirming a loan was closed through Pocket. Keep it for your records.",
  },
};

/** HTML-escape a value that came from the database or a user's note. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "0x1234567890…abcdef" — long enough to identify, short enough to sit in a row. */
export function shortReference(reference: string): string {
  return reference.length > 20
    ? `${reference.slice(0, 10)}…${reference.slice(-6)}`
    : reference;
}

/** "20 Oct 2026, 14:32 UTC" — always names the zone it is reporting. */
export function formatReceiptDate(date: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

/** A detail row: label left, value right, hairline between rows. */
function detailRow(
  label: string,
  value: string,
  last = false,
): string {
  const divider = last ? "" : `border-bottom:1px solid ${LINE_LIGHT};`;
  return `
    <tr>
      <td class="e-line" style="padding:13px 0;${divider}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="104" valign="top" style="font-family:${FONT};font-size:12px;font-weight:500;line-height:1.5;color:${L.m};">
              ${esc(label)}
            </td>
            <td class="e-t" valign="top" align="right" style="font-family:${FONT};font-size:14px;font-weight:600;line-height:1.5;color:${L.t};word-break:break-word;">
              ${value}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function renderReceiptEmail(
  input: ReceiptEmailInput,
): RenderedReceiptEmail {
  const copy = KINDS[input.kind];
  const status = STATUS[input.status];
  const appUrl = (input.appUrl ?? "https://mpocket.tech").replace(/\/+$/, "");
  const network = input.network ?? "Mezo";
  const logoUrl = input.logoUrl ?? `${appUrl}/icon`;
  const timezone = input.timezone ?? "UTC";

  const confirmed = input.status === "confirmed";
  const heading = confirmed ? copy.heading : status.heading;
  const statusLabel = confirmed ? `Confirmed on ${network}` : status.label;
  const pillClass = confirmed
    ? "e-pill-ok"
    : input.status === "pending"
      ? "e-pill-warn"
      : "e-pill-rd";
  const preheaderText = confirmed ? statusLabel : status.preheader;

  const amountText = input.amount?.trim() || null;
  const counterpartyText = input.counterparty?.trim() || null;
  const note = input.note?.trim() ? input.note.trim() : null;
  const date = formatReceiptDate(input.at, timezone);

  const subject = confirmed
    ? copy.subject(amountText ?? "", counterpartyText ?? "")
    : `${status.subjectLead} — ${amountText ?? ""} ${copy.preposition ?? ""} ${counterpartyText ?? ""}`
        .replace(/\s+/g, " ")
        .replace(/\s+—\s*$/, "")
        .trim();
  const preheader = `${preheaderText} · ${date}`;

  /*
    The hidden preview line. Clients show this next to the subject in the
    inbox; the zero-width filler after it stops the body's first words from
    being pulled in after the text we chose.
  */
  const hiddenPreheader = `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`;

  const amountBlock = amountText
    ? `<div class="e-amount" style="margin-top:14px;font-family:${FONT};font-size:48px;font-weight:600;line-height:1.1;letter-spacing:-1.2px;color:${ON_YELLOW};font-variant-numeric:tabular-nums;">
                      ${esc(amountText)}
                    </div>`
    : "";

  const heroSub =
    copy.preposition && counterpartyText
      ? `<div style="margin-top:6px;font-family:${FONT};font-size:15px;font-weight:500;line-height:1.45;color:${ON_YELLOW_MUTED};">
                      ${copy.preposition} <span style="font-weight:600;color:${ON_YELLOW};">${esc(counterpartyText)}</span>
                    </div>`
      : `<div style="margin-top:8px;font-family:${FONT};font-size:15px;font-weight:500;line-height:1.45;color:${ON_YELLOW_MUTED};">
                      Your Bitcoin is back in your wallet.
                    </div>`;

  /*
    The record. The counterparty row is first because it is the fact people
    scan for; everything the route or the chain knows beyond it follows, then
    the date and the reference that make the document checkable.
  */
  const details = input.details ?? [];
  const rows: { label: string; value: string }[] = [];

  if (copy.preposition && counterpartyText) {
    const addressLine =
      input.counterpartyAddress &&
      input.counterpartyAddress.toLowerCase() !== counterpartyText.toLowerCase()
        ? `<div style="margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:500;color:${L.m};">${esc(input.counterpartyAddress)}</div>`
        : "";
    rows.push({
      label: copy.preposition === "to" ? "To" : "From",
      value: `<span>${esc(counterpartyText)}</span>${addressLine}`,
    });
  }

  for (const detail of details) {
    rows.push({ label: detail.label, value: esc(detail.value) });
  }

  if (note) rows.push({ label: "Note", value: esc(note) });

  const referenceValue = input.explorerUrl
    ? `<a href="${esc(input.explorerUrl)}" style="color:${L.t};text-decoration:underline;text-underline-offset:2px;">${esc(shortReference(input.reference))}</a>`
    : `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;">${esc(shortReference(input.reference))}</span>`;

  rows.push({ label: "Date", value: esc(date) });
  rows.push({ label: "Network", value: esc(network) });
  rows.push({ label: "Reference", value: referenceValue });

  const detailRowsHtml = rows
    .map((row, index) => detailRow(row.label, row.value, index === rows.length - 1))
    .join("");

  const openUrl = `${appUrl}/home`;
  const explorerLink = input.explorerUrl
    ? `<tr>
         <td align="center" style="padding:14px 0 0;">
           <a href="${esc(input.explorerUrl)}" style="font-family:${FONT};font-size:12px;font-weight:600;color:${L.m};text-decoration:underline;text-underline-offset:2px;">View transaction</a>
         </td>
       </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${esc(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&display=swap");

    html, body { margin:0 !important; padding:0 !important; width:100% !important; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse !important; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }

    @media only screen and (max-width:620px) {
      .e-shell { width:100% !important; }
      .e-pad { padding-left:16px !important; padding-right:16px !important; }
      .e-hero-pad { padding:24px 20px 22px !important; }
      .e-amount { font-size:42px !important; }
      .e-header-pad { padding-bottom:18px !important; }
    }

    /*
      Dark mode, with the app's own dark values. Gmail honours these in its
      apps; clients that ignore the query show the light receipt, which is the
      reference theme the brand kit is drawn in.
    */
    @media (prefers-color-scheme: dark) {
      .e-body { background:${D.bg} !important; }
      .e-card { background:${D.s} !important; }
      .e-t { color:${D.t} !important; }
      .e-m { color:${D.m} !important; }
      .e-line { border-color:${LINE_DARK} !important; }
      .e-inv { background:${D.inv} !important; color:${D.invt} !important; }
      .e-wordmark { color:${D.t} !important; }
      .e-pill-ok { color:${L.gInk} !important; }
      .e-pill-warn { color:${WARN_INK_DARK} !important; }
      .e-pill-rd { color:${D.rInk} !important; }
    }
  </style>
</head>
<body class="e-body" style="margin:0;padding:0;background:${L.bg};">
  ${hiddenPreheader}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-body" style="background:${L.bg};">
    <tr>
      <td align="center" style="padding:28px 12px 36px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="e-shell" style="width:600px;max-width:600px;">

          <!-- Header: the mark, the wordmark, and the word "Receipt". -->
          <tr>
            <td class="e-header-pad e-pad" style="padding:0 4px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:10px;">
                          <img src="${esc(logoUrl)}" width="34" height="34" alt="Pocket" style="display:block;width:34px;height:34px;border-radius:11px;" />
                        </td>
                        <td valign="middle">
                          <span class="e-wordmark" style="font-family:${FONT};font-size:21px;font-weight:700;letter-spacing:-0.6px;color:${L.t};">pocket<span style="color:${L.p};">.</span></span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="e-m" align="right" valign="middle" style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:0.14em;color:${L.m};">
                    RECEIPT
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- The money card. Yellow in both themes: it is an object, not a page. -->
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${YELLOW}" style="background:${YELLOW};border-radius:24px;">
                <tr>
                  <td class="e-hero-pad" align="center" style="padding:30px 24px 26px;">

                    <!-- The status disc. A rounded cell, which Outlook squares off. -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                      <tr>
                        <td width="48" height="48" align="center" valign="middle" bgcolor="${status.disc}" style="width:48px;height:48px;background:${status.disc};border-radius:24px;font-family:${FONT};font-size:23px;font-weight:700;line-height:48px;color:#ffffff;">
                          ${status.glyph}
                        </td>
                      </tr>
                    </table>

                    <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>

                    <h1 style="margin:0;font-family:${FONT};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:0;color:${ON_YELLOW};">
                      ${heading}
                    </h1>

                    ${amountBlock}

                    ${heroSub}

                    <div style="height:16px;line-height:16px;font-size:0;">&nbsp;</div>

                    <span class="${pillClass}" style="display:inline-block;padding:4px 11px;border-radius:12px;background:${status.pillBg};font-family:${FONT};font-size:11px;font-weight:600;line-height:1.4;color:${status.pillInk};">
                      ${statusLabel}
                    </span>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- The record. Surface card, inverted in dark mode. -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-card" bgcolor="${L.s}" style="background:${L.s};border-radius:24px;">
                <tr>
                  <td class="e-pad" style="padding:6px 24px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${detailRowsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- One action. The brand has one primary button per screen. -->
          <tr>
            <td align="center" style="padding:22px 4px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${L.inv}" style="border-radius:27px;">
                    <a class="e-inv" href="${esc(openUrl)}" target="_blank" style="display:inline-block;padding:16px 30px;border-radius:27px;background:${L.inv};font-family:${FONT};font-size:15px;font-weight:600;line-height:1.2;color:${L.invt};">
                      Open Pocket
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${explorerLink}
              </table>
            </td>
          </tr>

          <!-- Footer. Small, quiet, and honest about what this is. -->
          <tr>
            <td class="e-pad" align="center" style="padding:30px 12px 0;">
              <div class="e-wordmark" style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:-0.3px;color:${L.t};">
                pocket<span style="color:${L.p};">.</span>
              </div>
              <div class="e-m" style="margin-top:8px;font-family:${FONT};font-size:11px;font-weight:500;line-height:1.6;color:${L.m};">
                ${copy.footer}
              </div>
              <div class="e-m" style="margin-top:4px;font-family:${FONT};font-size:11px;font-weight:500;line-height:1.6;color:${L.m};">
                Sent by Pocket &middot; receipts@mpocket.tech
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  const textLines = [
    "Pocket — receipt",
    "",
    confirmed ? heading.replace(/&hellip;/g, "…") : status.heading,
    amountText
      ? `${amountText}${copy.preposition && counterpartyText ? ` ${copy.preposition} ${counterpartyText}` : ""}`
      : "Your Bitcoin is back in your wallet.",
    statusLabel,
    "",
    ...(copy.preposition && counterpartyText
      ? [
          `${copy.preposition === "to" ? "To" : "From"}: ${counterpartyText}`,
          ...(input.counterpartyAddress
            ? [`Address: ${input.counterpartyAddress}`]
            : []),
        ]
      : []),
    ...details.map((detail) => `${detail.label}: ${detail.value}`),
    ...(note ? [`Note: ${note}`] : []),
    `Date: ${date}`,
    `Network: ${network}`,
    `Reference: ${input.reference}`,
    ...(input.explorerUrl ? [`Transaction: ${input.explorerUrl}`] : []),
    "",
    `Open Pocket: ${openUrl}`,
    "",
    copy.footer,
    "Sent by Pocket · receipts@mpocket.tech",
  ];

  return {
    subject,
    preheader,
    html,
    text: textLines.join("\n"),
  };
}
