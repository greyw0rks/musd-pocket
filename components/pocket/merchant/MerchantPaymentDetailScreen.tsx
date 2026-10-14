"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Avatar } from "@/components/pocket/Avatar";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import {
  CheckIcon,
  CopyIcon,
  ReceiptIcon,
  RequestIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { useMounted } from "@/components/pocket/ui/useMounted";
import { formatMoney, PAYMENT_STATUS_LABEL } from "@/lib/formatters";
import { relativeTime } from "@/lib/utils";
import type { Transaction } from "@/features/payments/payment.types";

/**
 * Merchant payment details (Section 6, screen 33).
 *
 * One payment, from the business's side of the counter. It is close to the
 * personal receipt and deliberately not the same screen: the personal receipt
 * is a record of something *you did*, and this is a record of something that
 * came *in* — so the leading fact is who paid and how, and the open question
 * is whether the money has reached the business, which is what the settlement
 * row answers honestly ("nowhere yet").
 *
 * It links out to the full ledger receipt rather than reimplementing it, since
 * the reference, network and hash rows belong to the ledger and a second copy
 * would be a second thing to keep accurate.
 */
export function MerchantPaymentDetailScreen({
  transaction,
  onBack,
  onOpenReceipt,
}: {
  transaction: Transaction;
  onBack: () => void;
  /** The ledger's own receipt for the same entry. */
  onOpenReceipt: (transactionId: string) => void;
}) {
  const { session } = usePocket();
  const mounted = useMounted();
  const [copied, setCopied] = useState(false);

  const business =
    session?.user.businessName || session?.user.name || "Your business";

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(transaction.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // The reference is on screen and selectable either way.
    }
  }

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Payment" subtitle="Money in" onBack={onBack} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="pk-card flex flex-col items-center"
      >
        <span className="pk-ico pk-ico--lg !bg-[color-mix(in_srgb,var(--g)_14%,transparent)] text-[var(--g-ink)]">
          <RequestIcon size={20} />
        </span>

        <p className="pk-m mt-3 font-semibold uppercase">
          Received by {business}
        </p>

        <p className="pk-pos mt-1 text-[34px] leading-none font-bold tracking-tight tabular-nums">
          +{formatMoney(transaction.amountUnits)}
        </p>

        <div className="mt-5 flex max-w-full items-center gap-2.5 rounded-full bg-[var(--s2)] py-1.5 pr-4 pl-1.5">
          <Avatar name={transaction.recipientName} size={26} />
          <span className="truncate text-[12px] font-semibold">
            {transaction.recipientName}
          </span>
          <span className="pk-m truncate">{transaction.recipientHandle}</span>
        </div>

        <p className="pk-m mt-3">
          {mounted ? relativeTime(transaction.createdAt) : "—"}
        </p>
      </motion.div>

      <div className="mt-5 space-y-5">
        <ListGroup label="This payment">
          <ListRow
            as="div"
            title="Status"
            trailing={
              <span className="text-[12px] font-semibold text-[var(--m)]">
                {PAYMENT_STATUS_LABEL[transaction.status]}
              </span>
            }
          />
          <ListRow
            as="div"
            title="Taken at"
            trailing={
              <span className="pk-m">
                {mounted ? relativeTime(transaction.createdAt) : "—"}
              </span>
            }
          />
          <ListRow
            as="div"
            title="Reference"
            subtitle="An identifier for this record inside the app."
            trailing={<span className="pk-m font-mono">{transaction.id}</span>}
          />
        </ListGroup>

        {/*
          The row a merchant will look for first, and the one most likely to be
          quietly lied about. Before testnet there is nowhere for money to land,
          so it says so instead of showing a settlement date that does not exist.
        */}
        <ListGroup label="Settlement">
          <ListRow
            as="div"
            title="Payout"
            subtitle="Takings have not been sent anywhere. Payout wiring is part of the Mezo integration."
            trailing={<span className="pk-pill pk-pill--warn">Not wired</span>}
          />
        </ListGroup>

        <div className="space-y-2">
          <Button
            full
            size="lg"
            variant="secondary"
            icon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            onClick={() => void copyReference()}
          >
            {copied ? "Copied" : "Copy reference"}
          </Button>

          <Button
            full
            size="lg"
            variant="ghost"
            icon={<ReceiptIcon size={16} />}
            onClick={() => onOpenReceipt(transaction.id)}
          >
            Open the full ledger receipt
          </Button>
        </div>

        <div className="flex justify-center pb-1">
          <DemoBadge label="Demo payment" />
        </div>
      </div>
    </div>
  );
}
