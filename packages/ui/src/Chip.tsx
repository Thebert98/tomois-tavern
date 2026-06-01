"use client";

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

type Tone = "default" | "active" | "warning" | "muted";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  default:
    "border-tavern-stone/40 bg-tavern-night/60 text-tavern-parchment/85",
  active:
    "border-tavern-gold/80 bg-tavern-gold/15 text-tavern-gold",
  warning:
    "border-tavern-blood/60 bg-tavern-blood/15 text-tavern-blood",
  muted:
    "border-tavern-stone/25 bg-transparent text-tavern-stone",
};

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, tone = "default", children, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "font-heading text-[0.6rem] uppercase tracking-[0.2em]",
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  ),
);
Chip.displayName = "Chip";
