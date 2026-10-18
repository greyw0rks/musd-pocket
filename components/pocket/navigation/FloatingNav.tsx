"use client";

import type { ReactElement } from "react";
import { motion } from "motion/react";
import {
  HomeIcon,
  SpendIcon,
  VaultIcon,
} from "@/components/pocket/icons";
import type { IconProps } from "@/components/pocket/icons";
import {
  DOCK_TABS,
  TAB_LABELS,
  type PocketTab,
} from "@/components/pocket/navigation/screens";
import { DOCK_MOTION } from "@/components/pocket/theme";

/**
 * The floating dock.
 *
 * Three tabs in a pill, and the only navigation control in the app that is
 * always in the same place. The current tab grows a white pill that reveals its
 * label — so the dock tells you where you are, not just where you can go, and
 * it does that without the label taking up room on the two tabs you can read
 * from their icons alone.
 *
 * **Switching tabs is a reset, not a push.** `onChange` hands the tab up and
 * the host resets the stack to `screenForTab(tab)`, so the dock never builds a
 * back stack behind itself. That is what makes these three tops rather than
 * three more things in a queue, and it is why this component takes no history
 * and knows nothing about the stack.
 *
 * The animation is `DOCK_MOTION`, the same spring the sheets use — the dock is
 * a surface with area, not a page, and the heavier spring is what keeps it from
 * feeling flicked. It is rendered inside an `AnimatePresence` in the host so
 * that it enters and leaves with the screens that own it rather than blinking
 * out when a send sheet covers it.
 *
 * The active tab is marked with `aria-current="page"` and *that* is what the
 * stylesheet keys the white pill off, so the visual state and the state a
 * screen reader announces come from one attribute rather than two that can
 * drift apart.
 */
export function FloatingNav({
  active,
  onChange,
}: {
  /** Which tab is current. `null` on a screen no tab owns. */
  active: PocketTab | null;
  onChange: (tab: PocketTab) => void;
}) {
  return (
    <motion.nav
      aria-label="Primary"
      variants={DOCK_MOTION}
      initial="initial"
      animate="animate"
      exit="exit"
      className="pk-nav"
      data-tour="nav"
    >
      {DOCK_TABS.map((tab) => {
        const label = TAB_LABELS[tab];
        const Icon = ICONS[tab];
        const isActive = active === tab;
        return (
          <motion.button
            key={tab}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(tab)}
            aria-label={label}
            title={label}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}

/** One icon per tab, kept here so the dock's tabs and their glyphs cannot drift. */
const ICONS: Record<PocketTab, (props: IconProps) => ReactElement> = {
  home: HomeIcon,
  vault: VaultIcon,
  spending: SpendIcon,
};
