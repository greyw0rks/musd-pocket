"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import {
  AtSignIcon,
  BriefcaseIcon,
  ChevronRightIcon,
  GearIcon,
  InfoIcon,
  MailIcon,
  ShieldIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { ReceiptsSheet } from "@/components/pocket/profile/ReceiptsSheet";
import { WALLET_COPY } from "@/components/pocket/profile/wallet-copy";
import { RECEIPTS_CHANNEL_LABEL } from "@/features/session/session.types";

/**
 * Profile.
 *
 * A personal account overview, pushed from the account overview screen so it
 * carries a back disc like every other pushed screen.
 *
 * It is deliberately the smallest screen that is still *true*: who you are,
 * what this account is, and what state the wallet is in. Everything else about
 * a person's settings lives one tap away under Settings, which is where
 * Appearance is — and Appearance is the control that decides whether this
 * screen is white or black, so it has to be reachable from a screen the user
 * actually opens.
 *
 * The wallet row is the interesting one. Before testnet there is no wallet,
 * and the honest thing to render is not a masked address or a "Connect"
 * button that does nothing — it is the statement that provisioning has not
 * happened yet, with the reason.
 */
export function ProfileScreen({
  onBack,
  onOpenSettings,
}: {
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const { session, signOut } = usePocket();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);

  const user = session?.user;
  const isMerchant = user?.accountType === "merchant";
  const wallet = WALLET_COPY[session?.wallet.status ?? "none"];

  async function confirmSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setConfirming(false);
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader
        title="Profile"
        onBack={onBack}
        action={
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 460, damping: 22 }}
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="pk-ib outline-none"
          >
            <GearIcon size={20} />
          </motion.button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="pk-card pk-row"
        style={{ gap: 14 }}
      >
        <Avatar name={user?.name ?? "?"} src={user?.avatarUrl} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">
            {user?.name ?? "Not signed in"}
          </p>
          <p className="pk-m truncate">
            {user?.handle || "no username yet"}
          </p>
        </div>
        <span className="pk-pill shrink-0">
          {isMerchant ? "Business" : "Personal"}
        </span>
      </motion.div>

      <ListGroup label="Account">
        <ListRow
          as="div"
          leading={
            <span className="pk-ico">
              <BriefcaseIcon size={18} />
            </span>
          }
          title={isMerchant ? "Business account" : "Personal account"}
          subtitle="Set when you created your account."
        />
        <ListRow
          as="div"
          leading={
            <span className="pk-ico">
              <AtSignIcon size={18} />
            </span>
          }
          title="Username"
          subtitle="The only thing someone needs to pay you."
          trailing={<span className="pk-m">{user?.handle || "—"}</span>}
        />
        <ListRow
          onPress={() => setReceiptsOpen(true)}
          leading={
            <span className="pk-ico">
              <MailIcon size={18} />
            </span>
          }
          title="Receipts"
          subtitle={
            user?.receipts
              ? `${RECEIPTS_CHANNEL_LABEL[user.receipts.channel]} connected.`
              : "Not connected. No copies are being sent."
          }
          trailing={
            /* An address is one unbreakable token, so a long one is told where
               it may break rather than being allowed to push the row past the
               card's edge. */
            <span
              className="pk-m min-w-0 text-right"
              style={{ overflowWrap: "anywhere" }}
            >
              {user?.receipts?.address ?? "Not set"}
            </span>
          }
        />
        {isMerchant && user?.businessName ? (
          <ListRow
            as="div"
            leading={
              <span className="pk-ico">
                <BriefcaseIcon size={18} />
              </span>
            }
            title="Business name"
            trailing={<span className="pk-m">{user.businessName}</span>}
          />
        ) : null}
      </ListGroup>

      <ListGroup label="Wallet">
        <ListRow
          as="div"
          leading={
            <span className="pk-ico">
              <ShieldIcon size={18} />
            </span>
          }
          title={wallet.title}
          subtitle={wallet.detail}
          trailing={<span className="pk-pill pk-pill--warn">{wallet.badge}</span>}
        />
      </ListGroup>

      <ListGroup label="This build">
        <ListRow
          as="div"
          leading={
            <span className="pk-ico">
              <InfoIcon size={18} />
            </span>
          }
          title="Mezo testnet"
          subtitle="Real balances on a test network. Worth nothing off it."
        />
      </ListGroup>

      <ListGroup>
        <ListRow
          onPress={onOpenSettings}
          leading={
            <span className="pk-ico">
              <GearIcon size={18} />
            </span>
          }
          title="Settings"
          subtitle="Appearance, notifications, contacts."
          trailing={<ChevronRightIcon size={16} />}
        />
      </ListGroup>

      <div className="mt-5">
        <Button
          full
          size="lg"
          variant="secondary"
          onClick={() => setConfirming(true)}
        >
          Sign out
        </Button>
      </div>

      <Sheet
        open={confirming}
        onClose={() => (signingOut ? undefined : setConfirming(false))}
        title="Sign out?"
      >
        <p className="pk-m text-center leading-relaxed">
          Your session ends. Your wallet and anything in it stay with your
          account — signing back in brings them straight back.
        </p>

        <div className="mt-5 space-y-2">
          <Button
            full
            size="lg"
            variant="danger"
            loading={signingOut}
            onClick={() => void confirmSignOut()}
          >
            Sign out
          </Button>
          <Button
            full
            size="lg"
            variant="ghost"
            disabled={signingOut}
            onClick={() => setConfirming(false)}
          >
            Stay signed in
          </Button>
        </div>
      </Sheet>

      <ReceiptsSheet
        open={receiptsOpen}
        onClose={() => setReceiptsOpen(false)}
      />
    </div>
  );
}
