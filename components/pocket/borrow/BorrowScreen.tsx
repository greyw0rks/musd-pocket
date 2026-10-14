"use client";

import { useState } from "react";
import { BorrowIcon } from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow, SectionLabel } from "@/components/pocket/ui/ListRow";
import { ScreenHeader } from "@/components/pocket/ui/ScreenHeader";
import { formatMoney } from "@/lib/formatters";

const TERMS = ["7 days", "14 days", "30 days"] as const;
type Term = (typeof TERMS)[number];

/**
 * Borrow.
 *
 * The reference's screen, kept whole: a yellow card stating the ceiling, a
 * row of repayment terms, a table of what the loan would cost, and a purple
 * call to action.
 *
 * Every figure on it is a real one, and the real ones are all zero. Pocket has
 * no collateral deposited, nothing outstanding, and no wallet connected to
 * Mezo — so the ceiling is `$0.00` and the terms table says the rate comes
 * from the chain rather than printing one.
 *
 * The reference prints `2.5%` interest and `$1,537.50` to repay, and those two
 * numbers are the reason this screen could not simply be copied. A rate is not
 * a display detail: Mezo sets it per trove from the collateral and the
 * protocol's own curve, and it is read on-chain at the moment of borrowing.
 * Any number printed here today would be a guess wearing the clothes of a
 * quote, and somebody would make a decision on it.
 *
 * So the term chips stay — they are a preference, and picking one costs
 * nothing — and the table beneath them reports what is known: nothing, and
 * where the rest comes from.
 */
export function BorrowScreen({ onBack }: { onBack: () => void }) {
  const [term, setTerm] = useState<Term>("14 days");

  return (
    <div className={SCREEN}>
      <ScreenHeader title="Borrow" onBack={onBack} />

      <div
        className="pk-card"
        style={{
          background: "var(--y)",
          color: "#111",
          border: 0,
          borderRadius: 26,
          padding: 22,
        }}
      >
        <span style={{ opacity: 0.7 }}>You can borrow up to</span>
        <div className="pk-big">{formatMoney(0n)}</div>
        <span style={{ opacity: 0.7, fontSize: 12 }}>
          No collateral deposited yet
        </span>
      </div>

      <SectionLabel className="mt-[18px] mb-1.5">Repay within</SectionLabel>
      <div className="pk-chips -mx-5 px-5">
        {TERMS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTerm(option)}
            aria-pressed={term === option}
            className={`pk-chip ${term === option ? "pk-chip--on" : ""}`}
          >
            {option}
          </button>
        ))}
      </div>

      <ListGroup>
        <ListRow
          as="div"
          title="Interest rate"
          trailing={<b className="text-[13px]">Set by Mezo</b>}
        />
        <ListRow
          as="div"
          title="Repayment date"
          trailing={<b className="text-[13px]">—</b>}
        />
        <ListRow
          as="div"
          title="You repay"
          trailing={<b className="text-[13px]">—</b>}
        />
      </ListGroup>

      <div className="pk-card" style={{ marginTop: 16, padding: "16px 20px" }}>
        <div className="pk-row" style={{ gap: 12, alignItems: "flex-start" }}>
          <span className="pk-ico" style={{ flex: "none" }}>
            <BorrowIcon size={18} />
          </span>
          <div>
            <b className="text-[14px]">Borrowing is not switched on yet</b>
            <p className="pk-m" style={{ marginTop: 2 }}>
              Pocket reads your collateral and the rate from Mezo when it
              borrows. There is no wallet connected to this build and no
              collateral deposited, so there is nothing to quote against — and
              nothing will be submitted from here.
            </p>
          </div>
        </div>
      </div>

      {/*
        Disabled rather than absent. A missing button reads as a screen that
        forgot one; a disabled button with its reason directly above reads as
        a feature that is not open, which is the truth.
      */}
      <Button full variant="purple" disabled className="mt-5">
        Borrow {formatMoney(0n)}
      </Button>
    </div>
  );
}
