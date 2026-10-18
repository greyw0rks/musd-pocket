"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { ComponentType } from "react";
import {
  BackIcon,
  BriefcaseIcon,
  CheckIcon,
  UserIcon,
} from "@/components/pocket/icons";
import { usePocket } from "@/components/pocket/store";
import { SCREEN_PLAIN, stagger } from "@/components/pocket/theme";
import { Button, IconButton } from "@/components/pocket/ui/Button";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/features/session/session.types";

const OPTIONS = [
  {
    id: "personal",
    Icon: UserIcon,
    title: "Personal",
    body: "Send and receive with the people you know.",
  },
  {
    id: "merchant",
    Icon: BriefcaseIcon,
    title: "Business",
    body: "Send and receive under a business name.",
  },
] as const satisfies readonly {
  id: AccountType;
  Icon: ComponentType<{ size?: number }>;
  title: string;
  body: string;
}[];

/**
 * Screen 03 — Account type.
 *
 * The choice is stored on the account and printed wherever the account is
 * described — the overview, the profile. It used to decide the dock as well,
 * and the cards named the navigation each option produced; there is no dock
 * now, so the cards no longer promise one. What is left is what is true: the
 * label.
 *
 * Nothing is spent by choosing — the profile screen that follows can change it.
 *
 * Selection is carried by the disc and a ring rather than by a lighter glass
 * fill. The old selected state was a `bg-white/[0.09]` wash over a dark page,
 * which was invisible in the light theme and read as "brighter" rather than
 * "chosen" in the dark one. An inverse-fill disc is unambiguous in both, and it
 * is the same language the chips already use for their selected state.
 */
export function AccountTypeScreen() {
  const { push, back, saveProfile, canGoBack } = usePocket();

  const [selected, setSelected] = useState<AccountType>("personal");
  const [saving, setSaving] = useState(false);

  async function next() {
    if (saving) return;
    setSaving(true);
    const problem = await saveProfile({ accountType: selected });
    setSaving(false);
    if (problem) return;
    push("profile-setup");
  }

  return (
    <div className={SCREEN_PLAIN}>
      <div className="flex min-h-11 items-center">
        {canGoBack ? (
          <IconButton label="Back" onClick={back}>
            <BackIcon size={22} />
          </IconButton>
        ) : null}
      </div>

      <div className="pt-5">
        <h1 className="pk-h1">How will you use Pocket?</h1>
        <p className="pk-m mt-2 max-w-[34ch] text-[13px] leading-relaxed">
          This labels your account. You can change it later.
        </p>
      </div>

      <div
        className="mt-6 flex-1 space-y-3"
        role="radiogroup"
        aria-label="Account type"
      >
        {OPTIONS.map(({ id, Icon, title, body }, index) => {
          const isSelected = selected === id;
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={stagger(index)}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelected(id)}
              className={cn(
                "pk-card w-full text-left outline-none transition",
                isSelected
                  ? "ring-2 ring-[var(--inv)]"
                  : "hover:bg-[var(--s2)] focus-visible:ring-2 focus-visible:ring-[var(--p)]",
              )}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={cn(
                    "pk-ico transition",
                    // The `!` is what makes "chosen" visible at all: `.pk-ico`
                    // is unlayered and owns its background, so without it the
                    // selected disc renders identical to the unselected one and
                    // the icon goes white-on-grey.
                    isSelected
                      ? "!bg-[var(--inv)] text-[var(--invt)]"
                      : "text-[var(--m)]",
                  )}
                >
                  <Icon size={18} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <b className="text-[14px] font-bold">{title}</b>
                    <motion.span
                      initial={false}
                      animate={{
                        opacity: isSelected ? 1 : 0,
                        scale: isSelected ? 1 : 0.7,
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="grid size-4 place-items-center rounded-full bg-[var(--g)] text-white"
                    >
                      <CheckIcon size={11} strokeWidth={3} />
                    </motion.span>
                  </span>

                  <span className="pk-m mt-1 block leading-relaxed">{body}</span>
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="pt-5">
        <Button full size="lg" loading={saving} onClick={() => void next()}>
          Continue
        </Button>
      </div>
    </div>
  );
}
