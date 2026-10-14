"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * A modal sheet.
 *
 * A panel that rises over a screen: a picker, a confirmation, a receipt. It is
 * opaque, the same surface as a card, with a heavier radius and a grab handle —
 * which is enough to say "this is on top" without translucency, and translucency
 * is the one thing that stops working the moment the app has a light theme.
 *
 * Escape closes it, the backdrop closes it, and the page behind cannot scroll
 * while it is open. `role="dialog"` plus `aria-modal` is what makes it a modal
 * to a screen reader and not just visually.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  // Freeze the page behind. Without this a drag inside the sheet scrolls the
  // screen underneath on touch devices.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col justify-end"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/45"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={cn(
              "pk-sheet pocket-scroll relative max-h-[85%] overflow-y-auto",
              "px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]",
              className,
            )}
          >
            <div className="pk-sheet-handle" aria-hidden="true" />

            {title ? (
              <h2 className="pk-h2 mb-4 text-center">{title}</h2>
            ) : null}

            {children}

            {footer ? <div className="mt-5">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
