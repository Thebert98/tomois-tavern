"use client";

import { HTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "./cn";

export interface SignBoardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
}

/**
 * A wooden tavern sign: oak-toned plank with gold trim and an optional
 * carved-style title. Used by the Notice Board entries, the Bard's
 * stage, and any "sign over a doorway" framing.
 */
export const SignBoard = forwardRef<HTMLDivElement, SignBoardProps>(
  ({ className, title, subtitle, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative rounded-xl border-2 border-tavern-oak bg-tavern-oak/80 px-5 py-4 text-tavern-parchment shadow-[inset_0_0_18px_rgba(0,0,0,0.5),0_18px_36px_-20px_rgba(0,0,0,0.7)]",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-md border border-tavern-gold/30"
      />
      {(title || subtitle) && (
        <div className="relative">
          {title && (
            <div className="font-heading text-sm uppercase tracking-[0.3em] text-tavern-gold">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="mt-1 text-[0.7rem] italic text-tavern-parchment/70">
              {subtitle}
            </div>
          )}
        </div>
      )}
      <div className={cn("relative", (title || subtitle) && "mt-3")}>
        {children}
      </div>
    </div>
  ),
);
SignBoard.displayName = "SignBoard";
