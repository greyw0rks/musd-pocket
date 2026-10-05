import { Bitcoin, Coins, Sparkles } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { Section, SectionTitle } from "@/components/landing/section";
import { NETWORK, TICKER } from "@/components/landing/constants";

const POINTS = [
  { icon: Bitcoin, label: "Bitcoin-native", sub: "Backed by BTC, not borrowed against it." },
  { icon: Coins, label: `${TICKER} payments`, sub: "Stable value for everyday spending." },
  { icon: Sparkles, label: "Built for everyday use", sub: "Simple, fast, and quiet." },
];

/** Deliberately the shortest section on the page (brief §14). */
export function MezoSection() {
  return (
    <Section className="text-center">
      <Reveal>
        <SectionTitle className="mx-auto max-w-2xl">
          Built on {NETWORK}. Powered by {TICKER}.
        </SectionTitle>
        <p className="mx-auto mt-5 max-w-lg text-lg text-muted text-pretty">
          Pocket uses {TICKER} to make Bitcoin-backed value practical for
          everyday payments.
        </p>
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-3xl gap-8 sm:grid-cols-3">
        {POINTS.map((point, i) => (
          <Reveal key={point.label} delay={i * 0.08}>
            <point.icon className="mx-auto size-5 text-mezo" />
            <h3 className="mt-4 font-semibold">{point.label}</h3>
            <p className="mt-1.5 text-sm text-muted text-pretty">
              {point.sub}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
