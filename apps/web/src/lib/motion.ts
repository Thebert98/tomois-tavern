"use client";

import type { Variants } from "framer-motion";

/**
 * Named Framer Motion variants matching docs/DESIGN.md §4.
 *
 * - settle: small bounce-in for things that "fit into place"
 *   (modals, cards, panels). Used by @tomois/ui Modal.
 * - unfurl: scroll/notice unrolling — y translate + opacity + a touch of
 *   skewY. For list rows arriving (notice board entries, gallery items).
 *
 * `flicker` and `breath` are CSS keyframes (see globals.css), accessed
 * via the `.flicker` and `.breath` utility classes.
 */

export const settle: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 22 },
  },
};

export const unfurl: Variants = {
  hidden: { opacity: 0, y: -8, skewY: -1.5 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    skewY: 0,
    transition: {
      delay: Math.min(i * 0.045, 0.4),
      type: "spring",
      stiffness: 140,
      damping: 18,
    },
  }),
};
