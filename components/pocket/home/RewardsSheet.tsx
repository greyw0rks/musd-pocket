"use client";

import { RewardsIcon } from "@/components/pocket/icons";
import { Button } from "@/components/pocket/ui/Button";
import { Sheet } from "@/components/pocket/ui/Sheet";

/**
 * What replaces the faucet icon once the claim is used.
 *
 * It is a promise with a date that has not been set, so it says exactly what
 * is planned and no numbers: points for using the app, paid out in Mezo tokens.
 * A mock balance here would be the one thing on the home screen that is not
 * real, which is the opposite of the point.
 */
export function RewardsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Rewards">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--s2)]">
          <RewardsIcon size={26} />
        </span>

        <p className="pk-h2 mt-4">Coming soon</p>
        <p className="pk-m mt-2 leading-relaxed">
          Use Pocket to earn points and receive Mezo token rewards. Every send,
          save and borrow will count — we&apos;re building it now.
        </p>
      </div>

      <Button
        full
        size="lg"
        variant="secondary"
        className="mt-5"
        onClick={onClose}
      >
        Got it
      </Button>
    </Sheet>
  );
}
