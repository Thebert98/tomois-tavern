"use client";

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Add a gold seal in the top-right corner. */
  seal?: boolean;
  /** Tighten padding. */
  compact?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, seal, compact, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative rounded-xl border border-tavern-gold/25 bg-tavern-night/70 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] backdrop-blur",
        compact ? "p-4" : "p-6",
        className,
      )}
      {...rest}
    >
      {seal && (
        <span
          aria-hidden
          className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-tavern-gold shadow-[0_0_12px_rgba(212,175,55,0.55)]"
        />
      )}
      {children}
    </div>
  ),
);
Card.displayName = "Card";
