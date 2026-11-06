"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { registerOverlayBack } from "@/lib/native/back";
import { cn } from "@/lib/utils";

const subscribeRoot = () => () => {};
const getModalRoot = () => document.querySelector(".pk-app") ?? document.body;
const getServerRoot = () => null;

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
  const panel = useRef<HTMLDivElement>(null);
  // Keep overlays outside screen scrollers. Focusing a field must scroll the
  // sheet's content, not move the entire sheet with the underlying screen.
  const modalRoot = useSyncExternalStore(subscribeRoot, getModalRoot, getServerRoot);
  useEffect(() => {
    if (!open) return;
    return registerOverlayBack(() => { onClose(); return true; });
  }, [open, onClose]);
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
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panel.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not(.pk-sheet)')) return;
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href],select,textarea,[tabindex="0"]') ?? []);
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, [open, onClose]);

  return modalRoot ? createPortal(
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
            ref={panel}
            tabIndex={-1}
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
            <motion.div className="pk-sheet-grip" drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.25}
              onDragEnd={(_, info) => { if (info.offset.y > 70 || info.velocity.y > 600) onClose(); }}>
              <div className="pk-sheet-handle" aria-hidden="true" />
            </motion.div>
            <div className="pk-sheet-title">
              {title ? <h2 className="pk-h2">{title}</h2> : <span />}
              <button type="button" aria-label="Dismiss sheet" onClick={onClose} className="pk-ib">×</button>
            </div>

            {children}

            {footer ? <div className="mt-5">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    modalRoot,
  ) : null;
}
