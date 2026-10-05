import { ArrowDownLeft, ArrowUpRight, QrCode, Wallet } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { Amount, Eyebrow, Section, SectionTitle } from "@/components/landing/section";
import { QrMock } from "@/components/landing/qr-mock";
import { TICKER } from "@/components/landing/constants";

export function Features() {
  return (
    <Section id="product">
      <Reveal className="max-w-2xl">
        <Eyebrow>What you can do</Eyebrow>
        <SectionTitle className="mt-4">
          Everything a wallet should do, and nothing else.
        </SectionTitle>
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        <FeatureCard
          icon={ArrowUpRight}
          title="Send"
          body={`Send ${TICKER} to anyone.`}
          delay={0}
        >
          <PreviewShell>
            <Row label="To" value="@alex" />
            <AmountRow amount="20.00" action="Send" />
          </PreviewShell>
        </FeatureCard>

        <FeatureCard
          icon={ArrowDownLeft}
          title="Request"
          body="Ask for payment with a simple request."
          delay={0.06}
        >
          <PreviewShell>
            <Row label="From" value="@sam" />
            <AmountRow amount="15.00" action="Request" />
          </PreviewShell>
        </FeatureCard>

        <FeatureCard
          icon={Wallet}
          title="Pay"
          body="Scan, confirm, done."
          delay={0.12}
        >
          <PreviewShell>
            <div className="flex items-center gap-4">
              <QrMock className="size-16 shrink-0 rounded-md border border-border" />
              <div>
                <p className="text-sm font-medium">Scan to pay</p>
                <p className="mt-0.5 text-sm text-muted">
                  Point the camera. That&rsquo;s it.
                </p>
              </div>
            </div>
          </PreviewShell>
        </FeatureCard>

        <FeatureCard
          icon={QrCode}
          title="Receive"
          body="Get paid directly into Pocket."
          delay={0.18}
        >
          <PreviewShell>
            <Row label="From" value="@casey" />
            <AmountRow amount="50.00" action="View" tone="success" />
          </PreviewShell>
        </FeatureCard>
      </div>
    </Section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  delay,
  children,
}: {
  icon: typeof ArrowUpRight;
  title: string;
  body: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6">
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-mezo/10 text-mezo">
          <Icon className="size-5" />
        </span>
        <h3 className="mt-4 text-lg font-semibold">{title}</h3>
        <p className="mt-1.5 text-muted text-pretty">{body}</p>
        <div className="mt-6">{children}</div>
      </div>
    </Reveal>
  );
}

/* ---------------------------------------------------------------------------
   The previews are real product UI, not illustrations (brief §11) — but they
   are static markup, so they cost no client JS.
--------------------------------------------------------------------------- */

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function AmountRow({
  amount,
  action,
  tone = "default",
}: {
  amount: string;
  action: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <Amount className="text-base">
        {tone === "success" && "+"}
        {amount}{" "}
        <span className="text-sm font-medium text-muted">{TICKER}</span>
      </Amount>
      <span className="rounded-md bg-mezo/15 px-2.5 py-1 text-xs font-semibold text-mezo">
        {action}
      </span>
    </div>
  );
}
