import { ArrowRight } from "lucide-react";
import { CtaLink } from "@/components/landing/cta-link";
import { Reveal } from "@/components/landing/reveal";
import { Section } from "@/components/landing/section";
import { NETWORK, TICKER } from "@/components/landing/constants";

export function FinalCta() {
  return (
    <Section className="pb-8">
      <Reveal className="relative overflow-hidden rounded-3xl border border-border bg-surface px-8 py-16 text-center sm:px-16 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mezo/10 blur-3xl"
        />

        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[44px] lg:leading-[1.1]">
          Your Bitcoin shouldn&rsquo;t have to sit still.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-lg text-muted text-pretty">
          Use its value. Keep your Bitcoin.
        </p>

        <CtaLink href="/waitlist" size="lg" className="mt-9">
          Get early access
          <ArrowRight className="size-4" />
        </CtaLink>

        <p className="mt-8 text-sm text-muted">
          {TICKER} Pocket &middot; Built on {NETWORK}
        </p>
      </Reveal>
    </Section>
  );
}
