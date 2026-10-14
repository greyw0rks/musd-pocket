"use client";

import { motion } from "motion/react";
import { CheckIcon, ChevronRightIcon } from "@/components/pocket/icons";
import { homeScreenFor } from "@/components/pocket/navigation/screens";
import { usePocket } from "@/components/pocket/store";
import { SCREEN_PLAIN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { formatMoney } from "@/lib/formatters";

/**
 * Screen 05 — Onboarding complete.
 *
 * The payoff screen, and the last honest thing onboarding has to say. Section
 * 10 is explicit that before testnet nothing may claim to be on-chain, so the
 * card here names exactly what is seeded and what does not exist yet, on the
 * one screen where a user is most likely to assume otherwise.
 *
 * This is also the "demo-mode indicator" the Phase 1 brief asks for: rather
 * than a permanent badge in the chrome, the app states its own limits once,
 * plainly, and then gets out of the way. The balance keeps a small "Demo"
 * marker everywhere it appears.
 *
 * The full-bleed green fill is gone. It was the second of the app's two
 * un-invertible surfaces — a screen that could only ever be green is a screen
 * that looks like a different product in the dark theme, and this now turns
 * over with everything else. The tick disc carries the same signal in a
 * fraction of the area and carries it in both themes.
 *
 * The shape is deliberately the receipt's: disc, headline, one line of prose,
 * a quiet footnote, then the way out. Finishing onboarding and finishing a
 * payment are both moments where there is exactly one thing to read and one
 * thing to press.
 */
export function OnboardingDoneScreen() {
  const { session, balance, reset } = usePocket();

  const handle = session?.user.handle ?? "@you";

  return (
    <div className={SCREEN_PLAIN}>
      <div className="pk-center flex-1">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 15, delay: 0.1 }}
          className="pk-circ bg-[var(--g)]"
        >
          <CheckIcon size={48} />
        </motion.div>

        <motion.h1
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="pk-h1"
        >
          You&rsquo;re all set
        </motion.h1>

        <motion.span
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.24 }}
          className="pk-m"
        >
          <b className="text-[var(--t)]">{handle}</b> is ready to receive.
          People can send to it without knowing anything about your wallet.
        </motion.span>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.34 }}
          className="mt-2 flex flex-col items-center"
        >
          <span className="pk-m text-[10px] font-semibold tracking-wide uppercase">
            Demo balance
          </span>
          <span className="pk-big tabular-nums">{formatMoney(balance)}</span>
        </motion.div>

        {/*
          The one place the app is allowed to be blunt about itself. It is a
          card rather than a tinted panel so it reads as content the user has
          been told, not as a warning banner they have to dismiss.
        */}
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.44 }}
          className="pk-card mt-4 w-full space-y-2 px-4 py-3.5 text-left text-[11px] leading-relaxed text-[var(--m)]"
        >
          {[
            "This balance is seeded demo data, not money you own.",
            "Nothing is on a blockchain. No wallet has been created.",
            "Transfers are recorded inside this app and nowhere else.",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--m)]"
              />
              <span>{line}</span>
            </li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 grid w-full"
        >
          <Button
            full
            icon={<ChevronRightIcon size={16} />}
            onClick={() =>
              reset(homeScreenFor(session?.user.accountType ?? "personal"))
            }
          >
            Go to Pocket
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
