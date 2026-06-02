"use client";

import { Input, Label, cn } from "@tomois/ui";
import { ALIGNMENTS, type Alignment } from "@/lib/srd";
import type { FireplaceState } from "../FireplaceWizard";

const SHORT: Record<Alignment, string> = {
  "Lawful Good": "LG",
  "Neutral Good": "NG",
  "Chaotic Good": "CG",
  "Lawful Neutral": "LN",
  "True Neutral": "TN",
  "Chaotic Neutral": "CN",
  "Lawful Evil": "LE",
  "Neutral Evil": "NE",
  "Chaotic Evil": "CE",
};

export function AlignmentLevelStep({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>Alignment</Label>
        <div className="grid grid-cols-3 gap-2">
          {ALIGNMENTS.map((a) => {
            const active = state.alignment === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => set({ alignment: active ? "" : a })}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border px-2 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
                  active
                    ? "border-tavern-gold/80 bg-tavern-gold/15 text-tavern-gold"
                    : "border-tavern-stone/30 bg-tavern-night/50 text-tavern-parchment/80 hover:border-tavern-gold/60",
                )}
              >
                <span className="font-heading text-base uppercase tracking-[0.18em]">
                  {SHORT[a]}
                </span>
                <span className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/55">
                  {a.split(" ")[0]} · {a.split(" ")[1]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs italic text-tavern-parchment/55">
          Optional — leave none and the fire chooses one that fits.
        </p>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="hero-level">Level</Label>
          <Input
            id="hero-level"
            type="number"
            min={1}
            max={20}
            value={state.level}
            onChange={(e) => {
              const n = Number(e.target.value);
              set({
                level: Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 1,
              });
            }}
          />
        </div>
        <div className="text-right">
          <span className="font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/45">
            most heroes begin at
          </span>
          <div className="font-heading text-base uppercase tracking-[0.25em] text-tavern-gold">
            lvl 1
          </div>
        </div>
      </div>
    </div>
  );
}
