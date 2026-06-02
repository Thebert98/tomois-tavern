"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Card, Input, Label } from "@tomois/ui";
import { levelUpHighlights } from "@/lib/srd";
import type { LevelUpState } from "./types";

export function TargetStep({
  state,
  set,
}: {
  state: LevelUpState;
  set: (patch: Partial<LevelUpState>) => void;
}) {
  const highlights = useMemo(
    () => levelUpHighlights(state.charClass, state.fromLevel, state.target),
    [state.charClass, state.fromLevel, state.target],
  );
  return (
    <div className="space-y-4">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="lvlup-target">Target level</Label>
          <Input
            id="lvlup-target"
            type="number"
            min={state.fromLevel + 1}
            max={20}
            value={state.target}
            onChange={(e) => {
              const n = Number(e.target.value);
              const t = Number.isFinite(n)
                ? Math.min(20, Math.max(state.fromLevel + 1, n))
                : state.fromLevel + 1;
              set({ target: t });
            }}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
            currently
          </span>
          <span className="font-heading text-xl text-tavern-gold">
            lvl {state.fromLevel}
          </span>
        </div>
      </div>

      {highlights.length > 0 && (
        <Card compact>
          <h4 className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-gold">
            What changes
          </h4>
          <ul className="mt-2 space-y-1 text-sm text-tavern-parchment/85">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-tavern-gold/80" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
