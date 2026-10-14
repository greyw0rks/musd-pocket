"use client";

import { motion } from "motion/react";
import { Avatar } from "@/components/pocket/Avatar";
import {
  ChevronRightIcon,
  ClockIcon,
  GearIcon,
  QrIcon,
  ReceiveIcon,
  VaultIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { PageHeading } from "@/components/pocket/ui/ScreenHeader";
import { WALLET_COPY } from "@/components/pocket/profile/wallet-copy";

/**
 * Merchant profile (Section 6, screen 28).
 *
 * The business as a customer meets it, and the door to everything a business
 * owns. This is the dock's third tab, so it is a place rather than a step: it
 * has no back button and it should answer "what is my business here" before it
 * offers any action.
 *
 * It is deliberately not the personal Profile screen. A person's profile is a
 * statement about them; a merchant's is a storefront — the name a customer is
 * about to see on a payment code, and the handle that code resolves to. Those
 * want different rows, so they are different screens rather than one screen
 * branching on a role.
 *
 * The storefront card used to be a hard-coded white sheet with `text-stone-*`
 * ink. That was the one card in the app that ignored the theme, and in the
 * light theme it was a white panel on a white page with grey text fighting it.
 * It is a `pk-card` now, so it inverts with everything else and the business
 * name lands at full contrast in both.
 */
export function MerchantProfileScreen() {
  const { session, push } = usePocket();

  const user = session?.user;
  const name = user?.businessName || user?.name || "Your business";
  const handle = user?.handle || "@yourbusiness";
  const wallet = session?.wallet;

  return (
    <div className={SCREEN}>
      <PageHeading title="Business" />
      <p className="pk-m -mt-2 mb-4">
        How customers see you, and where everything else lives.
      </p>

      {/* The storefront. The one place in the merchant app that shows the
          business the way a payer will actually encounter it. */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="pk-card flex flex-col items-center !py-7"
      >
        <Avatar name={name} size={64} />

        <p className="mt-3 text-[15px] font-bold">{name}</p>
        <p className="pk-m mt-0.5 max-w-full truncate font-semibold">{handle}</p>

        <span className="pk-pill pk-pill--info mt-3">Business account</span>
      </motion.section>

      <p className="pk-m mt-3 px-1 leading-relaxed">
        Customers pay you by scanning a code or opening a link that carries{" "}
        <span className="text-[var(--t)]">{handle}</span>. The name above is what
        they see when it opens.
      </p>

      {/* --------------------------------------------- the two daily actions */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Button
          size="lg"
          className="h-14 justify-start px-4"
          icon={<ReceiveIcon size={16} />}
          onClick={() => push("merchant-receive")}
        >
          Charge
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="h-14 justify-start px-4"
          icon={<QrIcon size={16} />}
          onClick={() => push("merchant-qr")}
        >
          Counter code
        </Button>
      </div>

      <div className="mt-5 space-y-5">
        <ListGroup label="Your business">
          <ListRow
            leading={<ClockIcon size={16} className="pk-m" />}
            title="Payment history"
            subtitle="Everything you have taken, by period."
            onPress={() => push("merchant-payments")}
          />
          <ListRow
            leading={<GearIcon size={16} className="pk-m" />}
            title="Business settings"
            subtitle="Name, handle, receipts and payouts."
            onPress={() => push("merchant-settings")}
          />
        </ListGroup>

        {/*
          Wallet state belongs here rather than buried, because a merchant who
          thinks they are being paid into an account needs to see plainly that
          no account exists yet. `WALLET_COPY` is the same table the personal
          profile reads, so the two cannot drift into saying different things
          about the same absence.
        */}
        <ListGroup label="Settlement">
          <ListRow
            as="div"
            leading={<VaultIcon size={16} className="pk-m" />}
            title={WALLET_COPY[wallet?.status ?? "none"].title}
            subtitle={WALLET_COPY[wallet?.status ?? "none"].detail}
            trailing={
              <>
                <span className="pk-pill">
                  {WALLET_COPY[wallet?.status ?? "none"].badge}
                </span>
                <ChevronRightIcon size={16} className="pk-m" />
              </>
            }
          />
        </ListGroup>

        <p className="pk-m px-1 pb-2 leading-relaxed">
          Nothing on this screen is connected to a payment network. Takings are
          seeded demo data, and payouts are not wired.
        </p>
      </div>
    </div>
  );
}
