import { Link2, QrCode, Receipt } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { Eyebrow, Section, SectionTitle } from "@/components/landing/section";
import { QrMock } from "@/components/landing/qr-mock";
import { NETWORK, TICKER } from "@/components/landing/constants";

const CAPABILITIES = [
  { icon: Link2, label: "Create payment links" },
  { icon: QrCode, label: "Accept QR payments" },
  { icon: Receipt, label: "Track every payment" },
];

export function Merchant() {
  return (
    <div className="border-y border-border bg-surface">
      <Section id="merchants">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>For merchants</Eyebrow>
            <SectionTitle className="mt-4">
              Get paid in {TICKER}.
            </SectionTitle>
            <p className="mt-5 max-w-md text-lg text-muted text-pretty">
              Take a payment in seconds — no terminal, no card fees, no
              settlement delay.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {CAPABILITIES.map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-mezo">
                    <item.icon className="size-4" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="flex justify-center">
            <div className="w-full max-w-xs rounded-2xl border border-border bg-background p-6 text-center shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Pocket Pay
              </p>
              <p className="mt-3 text-lg font-semibold">Coffee Shop</p>
              <p className="mt-1 flex items-baseline justify-center gap-1.5">
                <span className="tabular text-3xl font-semibold tracking-tight">
                  5.00
                </span>
                <span className="text-sm font-medium text-muted">{TICKER}</span>
              </p>

              <div className="mt-5 rounded-xl border border-border bg-white p-3">
                <QrMock className="w-full" title="Coffee Shop payment QR code" />
              </div>

              <p className="mt-4 text-sm text-muted">Scan to pay</p>
              <p className="mt-5 border-t border-border pt-4 text-xs text-muted">
                Powered by {NETWORK}
              </p>
            </div>
          </Reveal>
        </div>
      </Section>
    </div>
  );
}
