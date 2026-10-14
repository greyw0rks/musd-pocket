"use client";

import { motion } from "motion/react";
import { Avatar } from "@/components/pocket/Avatar";
import { CheckIcon } from "@/components/pocket/icons";
import type { Recipient } from "@/features/payments/payment.types";

/**
 * The recipient grid.
 *
 * A person is a face first and a handle second, which is why the name is bold
 * and the handle is small and muted — the reference's hierarchy, and the right
 * one for a picker you scan rather than read.
 *
 * The tick is the one addition. A recipient with no resolved address cannot be
 * paid, and that has to be visible *before* the amount is typed, not after the
 * swipe fails. Unverified people get a warning-coloured handle and no tick —
 * the warning ink derived from the token block, so it stays legible on both a
 * white card and a black one, which the amber this replaced did not.
 *
 * The disc behind the tick is the page colour rather than a fixed grey: it is
 * a hole punched in the portrait, and a hole has to be the colour of whatever
 * the portrait is sitting on.
 *
 * The grid does not scroll. It is inside the contacts screen's own column, and
 * a scroller inside a scroller is how the previous pass ended up with a list
 * that could not be reached on a short phone.
 */
export function ContactGrid({
  recipients,
  onSelect,
}: {
  recipients: Recipient[];
  onSelect: (recipient: Recipient) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-3 pt-4">
      {recipients.map((person, index) => {
        const payable = person.verified && Boolean(person.address);

        return (
          <motion.button
            key={person.id}
            type="button"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(index, 8) * 0.04 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onSelect(person)}
            className="flex cursor-pointer flex-col items-center rounded-2xl p-2 text-center outline-none transition hover:bg-[var(--s)] focus-visible:bg-[var(--s)]"
          >
            <span className="relative">
              <Avatar name={person.name} src={person.avatarUrl} size={56} />
              {payable ? (
                <span
                  aria-label="Verified"
                  className="absolute -right-0.5 -bottom-0.5 grid size-[18px] place-items-center rounded-full bg-[var(--g)] text-white ring-2 ring-[var(--bg)]"
                >
                  <CheckIcon size={11} />
                </span>
              ) : null}
            </span>

            <span className="mt-1.5 w-full truncate text-[12px] font-semibold">
              {person.name}
            </span>
            <span
              className="w-full truncate text-center text-[10px]"
              style={
                payable
                  ? { color: "var(--m)" }
                  : { color: "color-mix(in srgb, var(--y) 42%, var(--t))" }
              }
            >
              {payable ? person.handle : "Not verified"}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
