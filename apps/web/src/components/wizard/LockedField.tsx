"use client";

import { ReactNode } from "react";
import { Label } from "@tomois/ui";
import { FieldLock } from "./FieldLock";

/**
 * Composes a labelled input with the FieldLock toggle on the right. Use this
 * inside wizard steps so every pickable field has a consistent
 * "lock/free" affordance. When `locked === false` the LLM sees the value as
 * a suggestion it may revise; when `locked === true` it's bound.
 */
export interface LockedFieldProps {
  htmlFor?: string;
  label: string;
  locked: boolean;
  onToggleLock: () => void;
  /** The actual input (Input / select / Textarea / custom). */
  children: ReactNode;
  /** Optional hint shown under the input. */
  hint?: ReactNode;
}

export function LockedField({
  htmlFor,
  label,
  locked,
  onToggleLock,
  children,
  hint,
}: LockedFieldProps) {
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={htmlFor}>{label}</Label>
          {children}
        </div>
        <FieldLock locked={locked} onToggle={onToggleLock} label={label} />
      </div>
      {hint && (
        <p className="mt-1 text-[0.65rem] italic text-tavern-parchment/50">
          {hint}
        </p>
      )}
    </div>
  );
}
