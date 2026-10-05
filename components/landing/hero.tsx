import { ArrowRight } from "lucide-react";
import { CtaLink } from "@/components/landing/cta-link";
import { Eyebrow } from "@/components/landing/section";
import { Reveal } from "@/components/landing/reveal";
import { WalletMockup } from "@/components/landing/wallet-mockup";
import { NETWORK, TICKER } from "@/components/landing/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-16 px-6 pb-20 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-10 lg:pb-28">
        <div>
          <Eyebrow>
            {TICKER} Pocket
          </Eyebrow>

          <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-balance sm:text-[54px] lg:text-[66px]">
            Spend your Bitcoin without selling it.
          </h1>

          <p className="mt-6 max-w-md text-lg text-muted text-pretty">
            Use {TICKER} to send, request, and pay from one simple pocket.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <CtaLink href="/waitlist" size="lg">
              Get early access
              <ArrowRight className="size-4" />
            </CtaLink>
            <a
              href="#how-it-works"
              className="text-[15px] font-medium text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mezo/50 focus-visible:rounded"
            >
              Learn how it works
            </a>
          </div>

          <p className="mt-7 text-sm text-muted">
            Powered by {TICKER} on {NETWORK}.
          </p>
        </div>

        <Reveal className="flex justify-center lg:justify-end" delay={0.1}>
          <WalletMockup />
        </Reveal>
      </div>
    </section>
  );
}
