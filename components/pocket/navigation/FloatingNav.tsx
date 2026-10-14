"use client";

import type { ReactElement } from "react";
import { motion } from "motion/react";
import {
  HomeIcon,
  ReceiveIcon,
  SpendIcon,
  UserIcon,
  VaultIcon,
} from "@/components/pocket/icons";
import type { IconProps } from "@/components/pocket/icons";
import { DOCK_MOTION } from "@/components/pocket/theme";
import type { PocketTab } from "@/components/pocket/navigation/screens";
import type { AccountType } from "@/features/session/session.types";

/**
 * The floating dock.
 *
 * One dark pill, always dark in both themes. It floats over content that
 * scrolls beneath it, so it has to stay legible whatever passes under — and in
 * the light theme it is the only dark object on screen, which is what makes it
 * read as chrome rather than as another card.
 *
 * The active tab grows a white pill and reveals its label. That reveal is
 * doing real work: two of the three labels are not guessable from the icon
 * ("Vault" and "Spending" are close cousins as pictures), so the tab you are
 * on names itself and the other two stay quiet. The reference did exactly this,
 * and it is the reason three icons read as navigation rather than as buttons.
 *
 * The white pill is a CSS state keyed off `aria-current`, not a travelling
 * element: the pill changes *size* when the label appears, and a shared-layout
 * transition would animate the wrong geometry. The 0.35s `all` transition in
 * `.pk-nav > button` covers the growth on its own.
 *
 * A merchant gets a different three, because a merchant's world is money
 * arriving rather than money set aside.
 */
interface DockTab {
  id: PocketTab;
  label: string;
  Icon: (props: IconProps) => ReactElement;
}

const PERSONAL_TABS = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "vault", label: "Vault", Icon: VaultIcon },
  { id: "spending", label: "Spending", Icon: SpendIcon },
] as const satisfies readonly DockTab[];

const MERCHANT_TABS = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "payments", label: "Payments", Icon: ReceiveIcon },
  { id: "business", label: "Business", Icon: UserIcon },
] as const satisfies readonly DockTab[];

export function dockTabsFor(accountType: AccountType): readonly DockTab[] {
  return accountType === "merchant" ? MERCHANT_TABS : PERSONAL_TABS;
}

export function FloatingNav({
  active,
  onChange,
  accountType = "personal",
}: {
  active: PocketTab;
  onChange: (tab: PocketTab) => void;
  accountType?: AccountType;
}) {
  const tabs = dockTabsFor(accountType);

  return (
    <motion.nav
      aria-label="Primary"
      variants={DOCK_MOTION}
      initial="initial"
      animate="animate"
      exit="exit"
      className="pk-nav"
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <motion.button
            key={id}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(id)}
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
