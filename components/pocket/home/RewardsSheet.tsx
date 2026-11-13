"use client";

import { Button } from "@/components/pocket/ui/Button";
import { Sheet } from "@/components/pocket/ui/Sheet";
import { WeeklyTasks } from "./WeeklyTasks";

export function RewardsSheet({
  open,
  onClose,
  onManageLocks,
}: {
  open: boolean;
  onClose: () => void;
  onManageLocks: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Weekly tasks">
      <p className="pk-m mt-2 leading-relaxed">
        Explore payments, borrowing and saving with your testnet funds.
      </p>
      {open ? <WeeklyTasks /> : null}
      <Button
        full
        variant="secondary"
        className="mt-5"
        onClick={() => {
          onClose();
          onManageLocks();
        }}
      >
        Manage BTC locks
      </Button>
      <Button full size="lg" variant="ghost" className="mt-2" onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}
