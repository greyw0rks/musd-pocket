import { Bitcoin, Coins, Send } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { Section, SectionTitle, Eyebrow } from "@/components/landing/section";
import { TICKER } from "@/components/landing/constants";

const POINTS = [
  {
    icon: Bitcoin,
    title: "Hold",
    body: "Your Bitcoin stays yours. Pocket never takes custody of it.",
  },
  {
    icon: Coins,
    title: "Access",
    body: `Use ${TICKER} when you need spending power, backed by the Bitcoin you already have.`,
  },
  {
    icon: Send,
    title: "Pay",
    body: "Send money to a name instead of a wallet address every single time.",
  },
];

export function Problem() {
  return (
    <Section id="why">
      <Reveal className="max-w-2xl">
        <Eyebrow>The problem</Eyebrow>
        <SectionTitle className="mt-4">
          Bitcoin is valuable. Spending it shouldn&rsquo;t be complicated.
        </SectionTitle>
      </Reveal>

      <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {POINTS.map((point, i) => (
          <Reveal key={point.title} delay={i * 0.08}>
            <span className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-mezo">
              <point.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{point.title}</h3>
            <p className="mt-2 text-muted text-pretty">{point.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
