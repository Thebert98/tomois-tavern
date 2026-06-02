"use client";

import { useMemo } from "react";
import { ChevronRight, Quote } from "lucide-react";
import { Card, Chip, Label, Textarea } from "@tomois/ui";
import { ABILITIES, ABILITY_LABEL } from "@/lib/srd";
import { FieldLock } from "@/components/wizard/FieldLock";
import { applyAsiToStats, type LevelUpState } from "./types";

/**
 * Final pre-roll review. Summarizes the player's picks side-by-side with the
 * starting values, then offers the notes textarea. Submitting the wizard
 * patches the sheet (locks for each pick) and calls `/generate`.
 */
export function ReviewStep({
  state,
  set,
}: {
  state: LevelUpState;
  set: (patch: Partial<LevelUpState>) => void;
}) {
  const finalStats = useMemo(
    () => applyAsiToStats(state.baseStats, state.asi),
    [state.baseStats, state.asi],
  );
  const hpGain = Object.values(state.hp).reduce((a, h) => a + h.value, 0);
  const featNames = Object.values(state.asi)
    .filter((p) => p.mode === "feat" && p.featName?.trim())
    .map((p) => p.featName!.trim());

  const statRows = ABILITIES.map((ab) => {
    const before = state.baseStats[ab] ?? 0;
    const after = finalStats[ab] ?? 0;
    const delta = after - before;
    return { ab, before, after, delta };
  }).filter((r) => r.delta !== 0);

  return (
    <div className="space-y-4">
      <Card compact className="border-tavern-gold/30 bg-tavern-night/70">
        <div className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-gold">
          Climb summary
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-tavern-parchment/85">
          <Chip tone="active">
            lvl {state.fromLevel} → {state.target}
          </Chip>
          {hpGain > 0 && <Chip tone="active">+{hpGain} hp</Chip>}
          {featNames.length > 0 && (
            <Chip tone="active">
              feat{featNames.length > 1 ? "s" : ""}: {featNames.join(", ")}
            </Chip>
          )}
          {state.spellsAdded.length > 0 && (
            <Chip tone="active">
              {state.spellsAdded.length} new spell
              {state.spellsAdded.length > 1 ? "s" : ""}
            </Chip>
          )}
        </div>

        {statRows.length > 0 && (
          <div className="mt-3">
            <div className="font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
              ability changes
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {statRows.map((r) => (
                <span
                  key={r.ab}
                  className="inline-flex items-center gap-1 rounded-md border border-tavern-stone/35 bg-tavern-night/60 px-2 py-1 text-xs"
                >
                  <span className="font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/70">
                    {ABILITY_LABEL[r.ab]}
                  </span>
                  <span className="text-tavern-parchment/70">{r.before}</span>
                  <ChevronRight className="h-3 w-3 text-tavern-gold/60" />
                  <span className="font-heading text-tavern-gold">{r.after}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {state.spellsAdded.length > 0 && (
          <div className="mt-3">
            <div className="font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
              spells learned
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {state.spellsAdded.map((s) => (
                <Chip key={s} tone="active">
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <LockRow
          label="Ability scores"
          hint="Locked = your ASI picks are kept exactly."
          locked={state.locks.stats ?? true}
          onToggle={() =>
            set({
              locks: { ...state.locks, stats: !(state.locks.stats ?? true) },
            })
          }
        />
        <LockRow
          label="Spells"
          hint="Locked = the fire can't swap your picks."
          locked={state.locks.spells ?? true}
          onToggle={() =>
            set({
              locks: { ...state.locks, spells: !(state.locks.spells ?? true) },
            })
          }
        />
      </div>

      <div>
        <Label htmlFor="levelup-notes">
          <Quote className="mr-1 inline h-3 w-3" />
          What did your hero learn?
        </Label>
        <Textarea
          id="levelup-notes"
          rows={3}
          placeholder="e.g. they survived a near-miss at the burned harbor and grew warier."
          value={state.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

function LockRow({
  label,
  hint,
  locked,
  onToggle,
}: {
  label: string;
  hint: string;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-tavern-stone/30 bg-tavern-night/40 p-2">
      <div className="flex-1">
        <div className="font-heading text-[0.65rem] uppercase tracking-[0.25em] text-tavern-parchment/75">
          {label}
        </div>
        <p className="mt-0.5 text-[0.65rem] italic text-tavern-parchment/55">
          {hint}
        </p>
      </div>
      <FieldLock locked={locked} onToggle={onToggle} label={label} size="sm" />
    </div>
  );
}
