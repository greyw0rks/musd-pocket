import { Fragment } from "react";
import { ArrowUpRight, Bitcoin, CircleDollarSign } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { Eyebrow, Section, SectionTitle } from "@/components/landing/section";
import { TICKER } from "@/components/landing/constants";

const STEPS = [
  { icon: Bitcoin, label: "Your Bitcoin", sub: "Stays yours" },
  { icon: CircleDollarSign, label: TICKER, sub: "Spending power" },
  { icon: ArrowUpRight, label: "Payment", sub: "Done in seconds" },
];

/**
 * The whole product in three nodes (brief §9) — it should land in about three
 * seconds without reading a word. Vertical on mobile, horizontal from `md`.
 */
export function Flow() {
  return (
    <Section id="how-it-works">
      <Reveal className="flex flex-col items-center text-center">
        <Eyebrow>How it works</Eyebrow>
        <SectionTitle className="mt-4 max-w-2xl">
          Bitcoin in. Payments out. Nothing to bridge.
        </SectionTitle>
      </Reveal>

      <div className="mt-16 flex flex-col items-center justify-center md:flex-row md:items-start">
        {STEPS.map((step, i) => (
          <Fragment key={step.label}>
            <Node icon={step.icon} label={step.label} sub={step.sub} />
            {i < STEPS.length - 1 && <Connector delay={i * 1} />}
          </Fragment>
        ))}
      </div>
    </Section>
  );
}

function Node({
  icon: Icon,
  label,
  sub,
}: {
  icon: typeof Bitcoin;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex w-40 flex-col items-center text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-mezo shadow-sm">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold">{label}</p>
      <p className="mt-0.5 text-sm text-muted">{sub}</p>
    </div>
  );
}

/** One connector, two orientations: vertical below `md`, horizontal above. */
function Connector({ delay }: { delay: number }) {
  const style = { animationDelay: `${delay}s` };

  return (
    <>
      <div
        aria-hidden
        className="relative my-4 h-14 w-px bg-border md:hidden"
      >
        <span
          style={style}
          className="absolute size-1.5 rounded-full bg-mezo animate-[flow-y_2s_linear_infinite]"
        />
      </div>
      <div
        aria-hidden
        className="relative mt-7 hidden h-px w-24 bg-border md:block lg:w-36"
      >
        <span
          style={style}
          className="absolute size-1.5 rounded-full bg-mezo animate-[flow-x_2s_linear_infinite]"
        />
      </div>
    </>
  );
}
