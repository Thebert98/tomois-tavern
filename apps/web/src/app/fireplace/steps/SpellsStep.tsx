"use client";

import { useMemo } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { Card, Chip, cn } from "@tomois/ui";
import {
  CLASS_INFO,
  legalSpellsForClass,
  maxSpellLevel,
  spellsKnownAt,
  type SpellWithName,
} from "@/lib/srd";
import type { FireplaceState } from "../FireplaceWizard";

/**
 * Caster-only step. Lists every spell legal for the chosen class up to the
 * level's max spell level, grouped by spell level. The cantrips and leveled
 * spells caps come from `spellsKnownAt` — soft UX limits; the backend
 * validator still has final say.
 */
export function SpellsStep({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  const cap = useMemo(
    () => spellsKnownAt(state.char_class, state.level || 1),
    [state.char_class, state.level],
  );
  const maxLvl = useMemo(
    () => maxSpellLevel(state.char_class, state.level || 1),
    [state.char_class, state.level],
  );
  const byLevel = useMemo(() => {
    const groups = new Map<number, SpellWithName[]>();
    for (const s of legalSpellsForClass(state.char_class)) {
      if (s.level > maxLvl) continue;
      if (!groups.has(s.level)) groups.set(s.level, []);
      groups.get(s.level)!.push(s);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [state.char_class, maxLvl]);

  const selected = new Set(state.spells);
  const cantripsPicked = state.spells.filter(
    (n) => (state.char_class && legalSpellsForClass(state.char_class).find((s) => s.name === n)?.level === 0),
  ).length;
  const leveledPicked = state.spells.length - cantripsPicked;

  function toggle(name: string, level: number) {
    if (state.autoSpells) return;
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      // enforce cap
      if (level === 0 && cantripsPicked >= cap.cantrips) return;
      if (level > 0 && leveledPicked >= cap.spells) return;
      next.add(name);
    }
    set({ spells: Array.from(next) });
  }

  const info = CLASS_INFO[state.char_class];

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card compact className="border-tavern-stone/30">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-tavern-gold" />
          <div className="flex-1 text-sm text-tavern-parchment/80">
            <span className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-gold">
              {state.char_class} ·{" "}
              {info?.caster === "full"
                ? "full caster"
                : info?.caster === "half"
                  ? "half caster"
                  : info?.caster === "pact"
                    ? "pact caster"
                    : "non-caster"}
            </span>
            <p className="mt-1 text-xs italic text-tavern-parchment/60">
              {info?.prepared
                ? "Prepared casters can change spells on a long rest. Pick a starting palette."
                : "Known spells stick — pick carefully, or let the fire decide."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => set({ autoSpells: !state.autoSpells })}
            className={cn(
              "rounded-md border px-3 py-1.5 font-heading text-[0.6rem] uppercase tracking-[0.25em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
              state.autoSpells
                ? "border-tavern-gold/70 bg-tavern-gold/15 text-tavern-gold"
                : "border-tavern-stone/40 text-tavern-parchment/70 hover:border-tavern-gold/40",
            )}
          >
            <Sparkles className="mr-1 inline h-3 w-3" />
            {state.autoSpells ? "fire decides" : "let the fire decide"}
          </button>
        </div>
      </Card>

      {/* Counter */}
      {!state.autoSpells && (
        <div className="flex items-center gap-3 text-xs">
          <CounterChip
            label="cantrips"
            current={cantripsPicked}
            cap={cap.cantrips}
          />
          <CounterChip
            label="spells"
            current={leveledPicked}
            cap={cap.spells}
          />
        </div>
      )}

      {/* Spell groups */}
      {byLevel.length === 0 && (
        <p className="text-xs italic text-tavern-parchment/55">
          No spell slots at this level — the fire will fill in cantrips if you
          want any.
        </p>
      )}
      {byLevel.map(([lvl, spells]) => (
        <div key={lvl}>
          <div className="mb-2 font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
            {lvl === 0 ? "Cantrips" : `Level ${lvl}`}
          </div>
          <div className="flex flex-wrap gap-2">
            {spells.map((s) => {
              const checked = selected.has(s.name);
              const disabled =
                state.autoSpells ||
                (!checked &&
                  ((s.level === 0 && cantripsPicked >= cap.cantrips) ||
                    (s.level > 0 && leveledPicked >= cap.spells)));
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => toggle(s.name, s.level)}
                  disabled={disabled}
                  aria-pressed={checked}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
                    checked
                      ? "border-tavern-gold/70 bg-tavern-gold/15 text-tavern-gold"
                      : "border-tavern-stone/35 text-tavern-parchment/80 hover:border-tavern-gold/40",
                    disabled && "cursor-not-allowed opacity-40 hover:border-tavern-stone/35",
                    state.autoSpells && "italic",
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

function CounterChip({
  label,
  current,
  cap,
}: {
  label: string;
  current: number;
  cap: number;
}) {
  const done = cap > 0 && current === cap;
  return (
    <Chip tone={done ? "active" : "default"}>
      {current}/{cap} {label}
    </Chip>
  );
}
