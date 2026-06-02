"use client";

import { useMemo } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { Card, Chip, cn } from "@tomois/ui";
import {
  CLASS_INFO,
  SPELLS,
  legalSpellsForClass,
  maxSpellLevel,
  spellsKnownAt,
  type SpellWithName,
} from "@/lib/srd";
import type { LevelUpState } from "./types";

/**
 * Shown only when leveling unlocks new spell-slot levels OR grows the
 * cantrip count for a caster. Player can tick newly-available spells up to
 * the diff between target and current caps.
 */
export function SpellsStep({
  state,
  set,
}: {
  state: LevelUpState;
  set: (patch: Partial<LevelUpState>) => void;
}) {
  const capNow = useMemo(
    () => spellsKnownAt(state.charClass, state.fromLevel),
    [state.charClass, state.fromLevel],
  );
  const capTarget = useMemo(
    () => spellsKnownAt(state.charClass, state.target),
    [state.charClass, state.target],
  );
  const maxLvlNow = useMemo(
    () => maxSpellLevel(state.charClass, state.fromLevel),
    [state.charClass, state.fromLevel],
  );
  const maxLvlTarget = useMemo(
    () => maxSpellLevel(state.charClass, state.target),
    [state.charClass, state.target],
  );

  // Diffs available to add at the target level.
  const cantripsCanAdd = Math.max(0, capTarget.cantrips - capNow.cantrips);
  const spellsCanAdd = Math.max(0, capTarget.spells - capNow.spells);

  const known = new Set(state.currentSpells);
  const picked = new Set(state.spellsAdded);

  const byLevel = useMemo(() => {
    const groups = new Map<number, SpellWithName[]>();
    for (const s of legalSpellsForClass(state.charClass)) {
      if (s.level > maxLvlTarget) continue;
      // Skip already-known spells — only show the diff of what's new to learn.
      if (known.has(s.name)) continue;
      if (!groups.has(s.level)) groups.set(s.level, []);
      groups.get(s.level)!.push(s);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [state.charClass, maxLvlTarget, state.currentSpells]); // eslint-disable-line react-hooks/exhaustive-deps

  const cantripsPicked = state.spellsAdded.filter((n) => spellLevel(n) === 0).length;
  const leveledPicked = state.spellsAdded.length - cantripsPicked;

  function toggle(name: string, lvl: number) {
    const next = new Set(picked);
    if (next.has(name)) {
      next.delete(name);
    } else {
      if (lvl === 0 && cantripsPicked >= cantripsCanAdd) return;
      if (lvl > 0 && leveledPicked >= spellsCanAdd) return;
      next.add(name);
    }
    set({ spellsAdded: Array.from(next) });
  }

  const info = CLASS_INFO[state.charClass];

  return (
    <div className="space-y-4">
      <Card compact className="border-tavern-stone/30">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-tavern-gold" />
          <div className="flex-1 text-sm text-tavern-parchment/80">
            <span className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-gold">
              {state.charClass} climbs to level {state.target}
            </span>
            <p className="mt-1 text-xs italic text-tavern-parchment/60">
              {info?.prepared
                ? "Prepared casters re-prepare on a long rest — pick a few favorites; the fire fills the rest."
                : "Pick newly-known spells; cantrips at level 0, leveled spells above."}
              {maxLvlTarget > maxLvlNow && (
                <>
                  {" "}Slot ceiling rises: {maxLvlNow < 1 ? "cantrips" : `lvl ${maxLvlNow}`} → lvl {maxLvlTarget}.
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3 text-xs">
        <Chip tone={cantripsPicked === cantripsCanAdd ? "active" : "default"}>
          {cantripsPicked}/{cantripsCanAdd} new cantrips
        </Chip>
        <Chip tone={leveledPicked === spellsCanAdd ? "active" : "default"}>
          {leveledPicked}/{spellsCanAdd} new spells
        </Chip>
      </div>

      {byLevel.length === 0 && (
        <p className="text-xs italic text-tavern-parchment/55">
          <Sparkles className="mr-1 inline h-3 w-3" />
          No new spells unlocked at this level — the fire still adjusts your sheet.
        </p>
      )}
      {byLevel.map(([lvl, spells]) => (
        <div key={lvl}>
          <div className="mb-2 font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
            {lvl === 0 ? "Cantrips" : `Level ${lvl}`}
          </div>
          <div className="flex flex-wrap gap-2">
            {spells.map((s) => {
              const checked = picked.has(s.name);
              const cap = s.level === 0 ? cantripsCanAdd : spellsCanAdd;
              const used = s.level === 0 ? cantripsPicked : leveledPicked;
              const disabled = !checked && used >= cap;
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => toggle(s.name, s.level)}
                  disabled={disabled}
                  aria-pressed={checked}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
                    checked
                      ? "border-tavern-gold/70 bg-tavern-gold/15 text-tavern-gold"
                      : "border-tavern-stone/35 text-tavern-parchment/80 hover:border-tavern-gold/40",
                    disabled && "cursor-not-allowed opacity-40 hover:border-tavern-stone/35",
                  )}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function spellLevel(name: string): number {
  return SPELLS[name]?.level ?? 1;
}
