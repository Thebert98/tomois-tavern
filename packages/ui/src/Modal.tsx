"use client";

import {
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "./cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible heading; rendered in the header. */
  title?: ReactNode;
  /** Optional flavour line below the title. */
  description?: ReactNode;
  /** Body content (form, message). */
  children: ReactNode;
  /** Footer actions. Use Buttons. */
  footer?: ReactNode;
  /** Defaults to true; allow dismiss on backdrop click. */
  dismissOnBackdrop?: boolean;
}

/** Centered modal with vignette backdrop. Traps focus, closes on Escape. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Focus trap + initial focus.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0] ?? panelRef.current;
    first.focus({ preventScroll: true });
    return () => {
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-tavern-night/85 backdrop-blur-sm"
            onClick={() => dismissOnBackdrop && onClose()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className={cn(
              "relative w-full max-w-md rounded-t-2xl border border-tavern-gold/30 bg-tavern-night/95 p-6 text-tavern-parchment shadow-2xl",
              "sm:rounded-2xl",
            )}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 rounded p-1 text-tavern-parchment/50 transition-colors hover:bg-tavern-night/60 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
            >
              <X className="h-4 w-4" />
            </button>
            {title && (
              <h2 className="pr-8 font-heading text-base uppercase tracking-[0.25em] text-tavern-gold">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-2 text-sm italic text-tavern-parchment/65">
                {description}
              </p>
            )}
            <div className={cn(title && "mt-4")}>{children}</div>
            {footer && (
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
