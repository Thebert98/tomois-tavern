"use client";

import { Dices, Heart } from "lucide-react";
import { Chip, cn } from "@tomois/ui";
import { CLASS_INFO } from "@/lib/srd";
import { gainedLevels, type HpMethod, type LevelUpState } from "./types";

/**
 * Per gained level, the player picks how to settle their hit-die roll:
 *   - max: take the die's max face
 *   - avg: take the SRD's "average" rounded-up value (d6=4, d8=5, d10=6, d12=7)
 *   - roll: roll the die, accept the value (one re-roll allowed per click)
 *
 * Stored on `state.hp[level]`. The Review step shows the running total; the
 * sum is folded into `user_notes` on submit so the LLM weaves the gain into
 * personality / backstory.
 */
export function HitDiceStep({
  state,
  set,
}: {
  state: LevelUpState;
  set: (patch: Partial<LevelUpState>) => void;
}) {
  const die = CLASS_INFO[state.charClass]?.hitDie ?? 8;
  const levels = gainedLevels(state.fromLevel, state.target);

  function pick(level: number, method: HpMethod) {
    const value = resolveHp(die, method);
    set({ hp: { ...state.hp, [level]: { method, value } } });
  }

  const total = Object.values(state.hp).reduce((acc, h) => acc + h.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-md border border-tavern-stone/30 bg-tavern-night/50 px-3 py-2 text-xs text-tavern-parchment/75">
        <span className="inline-flex items-center gap-2">
          <Heart className="h-3 w-3 text-tavern-fire" />
          hit die <span className="font-heading text-tavern-gold">d{die}</span>
        </span>
        <span>
          running total{" "}
          <span className="font-heading text-tavern-gold">+{total}</span>
        </span>
      </div>

      <div className="space-y-2">
        {levels.map((lvl) => {
          const pick_ = state.hp[lvl];
          return (
            <div
              key={lvl}
              className="rounded-md border border-tavern-stone/30 bg-tavern-night/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-heading text-[0.65rem] uppercase tracking-[0.25em] text-tavern-parchment/65">
                  level {lvl}
                </span>
                {pick_ && (
                  <Chip tone="active">+{pick_.value} hp</Chip>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <MethodButton
                  label={`max (${die})`}
                  active={pick_?.method === "max"}
                  onClick={() => pick(lvl, "max")}
                />
                <MethodButton
                  label={`average (${avgValue(die)})`}
                  active={pick_?.method === "avg"}
                  onClick={() => pick(lvl, "avg")}
                />
                <MethodButton
                  label="roll"
                  icon={<Dices className="h-3 w-3" />}
                  active={pick_?.method === "roll"}
                  onClick={() => {
                    if (
                      pick_?.method === "roll" &&
                      !confirm("Reroll this level's hit die?")
                    ) {
                      return;
                    }
                    pick(lvl, "roll");
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MethodButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-heading text-[0.6rem] uppercase tracking-[0.25em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
        active
          ? "border-tavern-gold/70 bg-tavern-gold/15 text-tavern-gold"
          : "border-tavern-stone/35 text-tavern-parchment/70 hover:border-tavern-gold/40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function avgValue(die: number): number {
  // SRD "average" rounded up.
  return Math.ceil((die + 1) / 2);
}

function resolveHp(die: number, method: HpMethod): number {
  if (method === "max") return die;
  if (method === "avg") return avgValue(die);
  return 1 + Math.floor(Math.random() * die);
}
