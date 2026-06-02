"use client";

import { Lock, Unlock } from "lucide-react";

/**
 * Small lock/free toggle button. Reused by EditCharacterModal and by every
 * wizard step that wants to make a pick optional ("free" = the LLM may
 * change it; "locked" = the LLM must keep it).
 *
 * Lift-and-share extraction of EditCharacterModal's per-row lock toggle
 * (see commit history before the lift for the inline version).
 */
export interface FieldLockProps {
  locked: boolean;
  onToggle: () => void;
  /** Used for the screen-reader label and the tooltip. */
  label: string;
  /** Compact (icon-only) vs expanded (icon + text). */
  size?: "sm" | "md";
}

export function FieldLock({
  locked,
  onToggle,
  label,
  size = "md",
}: FieldLockProps) {
  const compact = size === "sm";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
      title={
        locked
          ? "locked — the fire keeps this"
          : "free — the fire may change this"
      }
      className={`inline-flex h-9 items-center gap-1 rounded-md border px-2 text-xs uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold ${
        locked
          ? "border-tavern-gold/80 bg-tavern-gold/15 text-tavern-gold"
          : "border-tavern-stone/35 text-tavern-parchment/55 hover:border-tavern-gold/50"
      } ${compact ? "h-7 px-1.5" : ""}`}
    >
      {locked ? (
        <>
          <Lock className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {!compact && <span>locked</span>}
        </>
      ) : (
        <>
          <Unlock className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {!compact && <span>free</span>}
        </>
      )}
    </button>
  );
}
