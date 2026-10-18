"use client";

import { motion } from "motion/react";
import { LockIcon, QrIcon, SendIcon } from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN_PLAIN, stagger } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";

const FEATURES = [
  { Icon: SendIcon, title: "Instant by username", body: "@someone is all you need." },
  { Icon: QrIcon, title: "Pay by scanning", body: "Works in person." },
  { Icon: LockIcon, title: "Keys stay yours", body: "Nothing is held on your behalf." },
] as const;

/**
 * Screen 01 — Welcome.
 *
 * The first thing anyone sees, so it has one job: say what Pocket is in a
 * sentence, and get out of the way. No carousel, no three-slide pitch — the
 * plan's whole question is whether sending MUSD to a person is easy, and a
 * marketing tour is the opposite of that answer.
 *
 * The notice above the button says which network this is, because a figure at
 * the end of onboarding is a figure the user will price against their own
 * currency unless the chain is named first.
 *
 * The dark gradient and the hard-coded white ink are gone. This was the last
 * screen that only worked in one theme — it painted a `to-black/40` wash and
 * then wrote white on top of it, which in the light theme was white on a
 * near-white page. It now sits on the page colour like every other screen and
 * takes its ink from the tokens, so it inverts with the rest of the app.
 */
export function WelcomeScreen() {
  const { push } = usePocket();

  return (
    <div className={SCREEN_PLAIN}>
      <div className="flex items-center gap-2.5 pt-2">
        <span className="grid size-9 place-items-center rounded-xl bg-[var(--p)] text-lg font-bold text-white">
          M
        </span>
        <span className="pk-h2">Pocket</span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-8">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...stagger(0, 0.06), type: "spring", stiffness: 260, damping: 26 }}
          className="text-[34px] leading-[1.1] font-bold tracking-tight text-[var(--t)]"
        >
          Send money
          <br />
          to anyone.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...stagger(1, 0.06), type: "spring", stiffness: 260, damping: 26 }}
          className="pk-m mt-3 max-w-[30ch] text-[13px] leading-relaxed"
        >
          A dollar balance you can send by username — no address to copy, no
          chain to think about.
        </motion.p>

        <ul className="mt-9 space-y-4">
          {FEATURES.map(({ Icon, title, body }, index) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={stagger(index + 2, 0.06)}
              className="flex items-center gap-3"
            >
              <span className="pk-ico !size-9 text-[var(--m)]">
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <b className="block text-[13px] font-semibold">{title}</b>
                <span className="pk-m">{body}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <p className="pk-card pk-m flex items-start gap-2.5 leading-relaxed">
          <span
            aria-hidden="true"
            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--y)]"
          />
          <span>
            This runs on Mezo&rsquo;s <b className="text-[var(--t)]">testnet</b>.
            The balance you see is real on that chain and worth nothing off it.
          </span>
        </p>

        <Button
          full
          size="lg"
          icon={<SendIcon size={16} />}
          onClick={() => push("auth")}
        >
          Get started
        </Button>

        <Button full variant="ghost" onClick={() => push("auth")}>
          I already have an account
        </Button>
      </div>
    </div>
  );
}
