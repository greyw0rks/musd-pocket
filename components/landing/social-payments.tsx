import { AtSign, Check } from "lucide-react";
import { CtaLink } from "@/components/landing/cta-link";
import { Reveal } from "@/components/landing/reveal";
import { Eyebrow, Section, SectionTitle } from "@/components/landing/section";
import { TICKER } from "@/components/landing/constants";

const PROMISES = ["No address.", "No chain selection.", "No copy + paste."];

export function SocialPayments() {
  return (
    <Section>
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <Eyebrow>Social payments</Eyebrow>
          <SectionTitle className="mt-4">
            Money should know who you&rsquo;re paying.
          </SectionTitle>
          <p className="mt-5 max-w-md text-lg text-muted text-pretty">
            Pay the person, not the hex string. Pocket turns a name into a
            payment.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-3">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-mezo/15">
                  <Check className="size-3.5 text-mezo" />
                </span>
                <span className="font-medium">{promise}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="flex justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
            <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-surface-2">
              <AtSign className="size-5 text-mezo" />
            </span>
            <p className="mt-4 text-lg font-semibold">@alex</p>
            <p className="mt-1 text-sm text-muted">You owe Alex</p>

            <p className="mt-6 flex items-baseline justify-center gap-2">
              <span className="tabular text-4xl font-semibold tracking-tight">
                20.00
              </span>
              <span className="text-base font-medium text-muted">{TICKER}</span>
            </p>

            <CtaLink href="/waitlist" size="lg" className="mt-6 w-full">
              Send 20 {TICKER}
            </CtaLink>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
