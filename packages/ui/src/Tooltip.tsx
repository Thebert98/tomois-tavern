"use client";

import { ReactNode, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * A simple opacity-fade tooltip. Trigger appears on hover OR focus
 * (a11y); content is `role="tooltip"` and announced via aria-describedby.
 */
export function Tooltip({ children, content, side = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            id={id}
            initial={{ opacity: 0, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "pointer-events-none absolute z-50 max-w-[14rem] rounded border border-tavern-gold/40 bg-tavern-oak px-2 py-1 text-[0.65rem] italic leading-snug text-tavern-parchment shadow-xl",
              side === "top"
                ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
                : "left-1/2 top-full mt-2 -translate-x-1/2",
              className,
            )}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
