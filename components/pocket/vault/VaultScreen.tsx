"use client";

import { useState } from "react";
import { DemoBadge } from "@/components/pocket/DemoBadge";
import { LockIcon, VaultIcon } from "@/components/pocket/icons";
import { SCREEN } from "@/components/pocket/theme";
import { Button } from "@/components/pocket/ui/Button";
import { ListGroup, ListRow } from "@/components/pocket/ui/ListRow";
import { ProgressBar } from "@/components/pocket/ui/ProgressBar";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { EmptyState } from "@/components/pocket/ui/States";
import { formatMoney } from "@/lib/formatters";
import type { VaultGoal } from "@/features/vault/vault.types";

/**
 * Vault.
 *
 * The reference's screen exactly: a purple total-saved card with a progress
 * bar and a goal caption, then a list of goals under a heading.
 *
 * The difference is that this one is empty, and says so. The reference fills
 * it with `$1,240.00` of `$2,000` and two named goals, which is a feature —
 * and Pocket has no vault: nothing sets money aside, nothing tracks a target,
 * and no service behind this screen can be asked for either.
 *
 * So the screen is drawn at zero and the one control on it explains why
 * rather than pretending to work. That is the same bargain the Borrow screen
 * makes, and for the same reason: a savings balance is a claim about money
 * that has moved, and this app does not make those until it can honour them.
 *
 * The props are the contract the adapter will fill. `savedUnits` and `goals`
 * are already the right shape, so wiring the vault later is a data change
 * rather than a rewrite.
 */
export function VaultScreen({
  savedUnits = 0n,
  goals = [],
}: {
  savedUnits?: bigint;
  goals?: readonly VaultGoal[];
}) {
  const [explaining, setExplaining] = useState(false);

  const targetUnits = goals.reduce((sum, goal) => sum + goal.targetUnits, 0n);
  const totalSaved = goals.length > 0 ? savedUnits : 0n;

  const caption =
    goals.length === 0
      ? "No goal set yet"
      : `${percentLabel(totalSaved, targetUnits)} of ${formatMoney(targetUnits)} goal`;

  return (
    <div className={`${SCREEN} pt-[max(env(safe-area-inset-top),16px)]`}>
      <h1 className="pk-h1" style={{ marginTop: 0 }}>
        Vault
      </h1>
      <p className="pk-m">Money set aside, out of reach.</p>

      <div
        className="pk-card"
        style={{
          margin: "16px 0",
          background: "var(--p)",
          color: "#fff",
          border: 0,
          borderRadius: 26,
          padding: 22,
        }}
      >
        <div className="pk-row pk-sp">
          <span style={{ opacity: 0.8 }}>Total saved</span>
          <DemoBadge tone="onPurple" />
        </div>

        <div className="pk-big">{formatMoney(totalSaved)}</div>

        <ProgressBar
          value={totalSaved}
          max={targetUnits}
          tone="onPurple"
          label={caption}
          className="mt-3.5 mb-1.5"
        />

        <span style={{ opacity: 0.8, fontSize: 12 }}>{caption}</span>
      </div>

      <ListGroup label="Goals">
        {goals.length > 0 ? (
          goals.map((goal) => (
            <ListRow
              key={goal.id}
              leading={
                <span className="pk-ico">
                  <VaultIcon size={18} />
                </span>
              }
              title={goal.name}
              subtitle={`${formatMoney(goal.savedUnits)} / ${formatMoney(goal.targetUnits)}`}
              trailing={
                <span className="pk-m tabular-nums">
                  {percentLabel(goal.savedUnits, goal.targetUnits)}
                </span>
              }
              as="div"
            />
          ))
        ) : (
          <EmptyState
            icon={<VaultIcon size={22} />}
            title="No goals yet"
            description="A goal keeps money set aside where it is not in the way of everyday spending."
            action={
              <Button size="sm" onClick={() => setExplaining(true)}>
                Set a goal
              </Button>
            }
          />
        )}
      </ListGroup>

      <div className="pk-card" style={{ marginTop: 16, padding: "16px 20px" }}>
        <div className="pk-row" style={{ gap: 12, alignItems: "flex-start" }}>
          <span className="pk-ico" style={{ flex: "none" }}>
            <LockIcon size={18} />
          </span>
          <div>
            <b className="text-[14px]">Vaults are not opened yet</b>
            <p className="pk-m" style={{ marginTop: 2 }}>
              Pocket cannot move money into a vault until your wallet is
              connected on Mezo. Nothing here is holding a balance.
            </p>
          </div>
        </div>
      </div>

      <Sheet
        open={explaining}
        onClose={() => setExplaining(false)}
        title="Vaults are not open yet"
        footer={
          <Button full onClick={() => setExplaining(false)}>
            Got it
          </Button>
        }
      >
        <p className="pk-m leading-relaxed">
          A vault sets money aside and tracks it against a goal. Moving money
          in needs a signed transfer on Mezo, and this build has no wallet
          connected to sign one — so there is nothing here to create yet.
        </p>
        <p className="pk-m mt-3 leading-relaxed">
          Once Mezo is wired, this screen fills with your real goals and the
          same total-saved card above starts counting.
        </p>
      </Sheet>
    </div>
  );
}

/** "62%" — the share of a goal that is funded, or the whole thing at zero. */
function percentLabel(value: bigint, target: bigint): string {
  if (target <= 0n || value <= 0n) return "0%";
  return `${Math.min(Math.round((Number(value) / Number(target)) * 100), 100)}%`;
}
