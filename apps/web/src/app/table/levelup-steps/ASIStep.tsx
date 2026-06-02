"use client";

import { ChevronUp, Star, BookOpen } from "lucide-react";
import { Chip, Input, cn } from "@tomois/ui";
import {
  ABILITIES,
  ABILITY_LABEL,
  ASI_LEVELS,
  type Ability,
} from "@/lib/srd";
import {
  crossedAsiLevels,
  type AsiPick,
  type LevelUpState,
} from "./types";

/**
 * One window per crossed ASI level (4 / 8 / 12 / 16 / 19). Each window
 * offers three modes: +2 to a single ability, +1 to two abilities, or a feat
 * (free-text name). Stats overflow caps at 20 per SRD.
 */
export function ASIStep({
  state,
  set,
}: {
  state: LevelUpState;
  set: (patch: Partial<LevelUpState>) => void;
}) {
  const windows = crossedAsiLevels(state.fromLevel, state.target, ASI_LEVELS);

  function updatePick(level: number, pick: AsiPick) {
    set({ asi: { ...state.asi, [level]: pick } });
  }

  return (
    <div className="space-y-4">
      {windows.map((lvl) => {
        const pick = state.asi[lvl];
        return (
          <div
            key={lvl}
            className="rounded-md border border-tavern-stone/30 bg-tavern-night/50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-heading text-[0.65rem] uppercase tracking-[0.25em] text-tavern-parchment/65">
                ASI · level {lvl}
              </span>
              {pickSummary(pick)}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <ModeButton
                label="+2 to one"
                icon={<ChevronUp className="h-3 w-3" />}
                active={pick?.mode === "single"}
                onClick={() =>
                  updatePick(lvl, {
                    mode: "single",
                    singleAbility: pick?.singleAbility,
                  })
                }
              />
              <ModeButton
                label="+1 to two"
                icon={<Star className="h-3 w-3" />}
                active={pick?.mode === "split"}
                onClick={() =>
                  updatePick(lvl, {
                    mode: "split",
                    splitA: pick?.splitA,
                    splitB: pick?.splitB,
                  })
                }
              />
              <ModeButton
                label="take a feat"
                icon={<BookOpen className="h-3 w-3" />}
                active={pick?.mode === "feat"}
                onClick={() =>
                  updatePick(lvl, {
                    mode: "feat",
                    featName: pick?.featName,
                  })
                }
              />
            </div>

            {pick?.mode === "single" && (
              <AbilityPicker
                value={pick.singleAbility}
                onChange={(ab) =>
                  updatePick(lvl, { mode: "single", singleAbility: ab })
                }
              />
            )}
            {pick?.mode === "split" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <AbilityPicker
                  label="+1 to"
                  value={pick.splitA}
                  exclude={pick.splitB}
                  onChange={(ab) =>
                    updatePick(lvl, { mode: "split", splitA: ab, splitB: pick.splitB })
                  }
                />
                <AbilityPicker
                  label="and +1 to"
                  value={pick.splitB}
                  exclude={pick.splitA}
                  onChange={(ab) =>
                    updatePick(lvl, { mode: "split", splitA: pick.splitA, splitB: ab })
                  }
                />
              </div>
            )}
            {pick?.mode === "feat" && (
              <div className="mt-3">
                <Input
                  placeholder="e.g. Sharpshooter, War Caster, Lucky"
                  value={pick.featName ?? ""}
                  onChange={(e) =>
                    updatePick(lvl, { mode: "feat", featName: e.target.value })
                  }
                />
                <p className="mt-1 text-[0.65rem] italic text-tavern-parchment/50">
                  Free-text — the fire weaves it into the sheet via your notes.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModeButton({
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
        "inline-flex items-center justify-center gap-1 rounded-md border px-3 py-2 font-heading text-[0.6rem] uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
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

function AbilityPicker({
  label,
  value,
  exclude,
  onChange,
}: {
  label?: string;
  value: Ability | undefined;
  exclude?: Ability;
  onChange: (ab: Ability) => void;
}) {
  return (
    <div className="mt-3">
      {label && (
        <span className="mb-1 block font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ABILITIES.map((ab) => {
          const disabled = exclude === ab;
          const active = value === ab;
          return (
            <button
              key={ab}
              type="button"
              onClick={() => onChange(ab)}
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                "rounded-md border px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
                active
                  ? "border-tavern-gold/70 bg-tavern-gold/15 text-tavern-gold"
                  : "border-tavern-stone/35 text-tavern-parchment/70 hover:border-tavern-gold/40",
                disabled && "cursor-not-allowed opacity-35",
              )}
            >
              {ABILITY_LABEL[ab]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function pickSummary(pick: AsiPick | undefined) {
  if (!pick) return null;
  if (pick.mode === "single" && pick.singleAbility) {
    return <Chip tone="active">+2 {ABILITY_LABEL[pick.singleAbility]}</Chip>;
  }
  if (pick.mode === "split" && pick.splitA && pick.splitB) {
    return (
      <Chip tone="active">
        +1 {ABILITY_LABEL[pick.splitA]} · +1 {ABILITY_LABEL[pick.splitB]}
      </Chip>
    );
  }
  if (pick.mode === "feat" && pick.featName?.trim()) {
    return <Chip tone="active">feat: {pick.featName.trim()}</Chip>;
  }
  return null;
}
