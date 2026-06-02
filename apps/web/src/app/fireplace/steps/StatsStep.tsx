"use client";

import { useMemo } from "react";
import { Dices, Minus, Plus, RotateCcw } from "lucide-react";
import { Button, Card, Chip, cn } from "@tomois/ui";
import { FieldLock } from "@/components/wizard/FieldLock";
import { recommendedAbilities } from "@/lib/playstyle";
import {
  ABILITIES,
  ABILITY_LABEL,
  applyRaceASI,
  pointBuyCost,
  rollScore,
  standardArray,
  type Ability,
} from "@/lib/srd";
import type { FireplaceState, StatsMethod } from "../FireplaceWizard";

const METHODS: { id: StatsMethod; label: string; flavor: string }[] = [
  {
    id: "array",
    label: "Standard array",
    flavor: "15 · 14 · 13 · 12 · 10 · 8 — fastest path to a legal sheet.",
  },
  {
    id: "pointbuy",
    label: "Point buy",
    flavor: "27 points to spend; abilities start at 8, max 15 before race bumps.",
  },
  {
    id: "roll",
    label: "Roll the dice",
    flavor: "Six rolls of 4d6-drop-lowest. Risky and exhilarating.",
  },
];

export function StatsStep({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  function chooseMethod(m: StatsMethod) {
    if (m === "array") {
      set({
        statsMethod: m,
        statsPool: standardArray(),
        stats: emptyStats(),
      });
    } else if (m === "pointbuy") {
      set({
        statsMethod: m,
        statsPool: [],
        stats: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      });
    } else {
      const pool = Array.from({ length: 6 }, rollScore).sort((a, b) => b - a);
      set({ statsMethod: m, statsPool: pool, stats: emptyStats() });
    }
  }

  if (!state.statsMethod) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => chooseMethod(m.id)}
            className="rounded-lg border border-tavern-stone/30 bg-tavern-night/50 p-4 text-left transition-colors hover:border-tavern-gold/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
          >
            <div className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-parchment">
              {m.label}
            </div>
            <p className="mt-1 text-[0.7rem] italic text-tavern-parchment/60">
              {m.flavor}
            </p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-gold">
          {METHODS.find((m) => m.id === state.statsMethod)?.label}
        </span>
        <button
          type="button"
          onClick={() => set({ statsMethod: null })}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/60 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
        >
          <RotateCcw className="h-3 w-3" />
          change method
        </button>
      </div>

      {state.statsMethod === "pointbuy" ? (
        <PointBuyEditor state={state} set={set} />
      ) : (
        <PoolEditor state={state} set={set} />
      )}

      <SummaryCard state={state} set={set} />
    </div>
  );
}

function emptyStats(): Record<Ability, number> {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

// ---- pool-based editor (standard array + roll) ----

function PoolEditor({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  const pool = state.statsPool;
  function place(ab: Ability, value: number) {
    const nextPool = [...pool];
    const idx = nextPool.indexOf(value);
    if (idx < 0) return;
    nextPool.splice(idx, 1);
    // If ability already had a value, return it to the pool.
    const prev = state.stats[ab];
    if (prev > 0) nextPool.push(prev);
    nextPool.sort((a, b) => b - a);
    set({ statsPool: nextPool, stats: { ...state.stats, [ab]: value } });
  }
  function clear(ab: Ability) {
    const prev = state.stats[ab];
    if (prev <= 0) return;
    const nextPool = [...pool, prev].sort((a, b) => b - a);
    set({ statsPool: nextPool, stats: { ...state.stats, [ab]: 0 } });
  }
  function rerollAll() {
    if (!confirm("Roll all six again? Any current assignments will be cleared.")) {
      return;
    }
    const next = Array.from({ length: 6 }, rollScore).sort((a, b) => b - a);
    set({ statsPool: next, stats: emptyStats() });
  }
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
          Pool {state.statsMethod === "roll" ? "(rolled)" : "(standard array)"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pool.length === 0 && (
            <span className="text-xs italic text-tavern-parchment/55">
              all placed
            </span>
          )}
          {pool.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-tavern-stone/40 bg-tavern-night/60 font-heading text-sm text-tavern-parchment"
            >
              {v}
            </span>
          ))}
          {state.statsMethod === "roll" && (
            <Button size="sm" variant="ghost" onClick={rerollAll}>
              <Dices className="h-3 w-3" />
              reroll all
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {ABILITIES.map((ab) => {
          const rec = recommendedAbilities(state.playStyle, state.char_class);
          const tier: "primary" | "secondary" | null =
            rec.primary === ab ? "primary" : rec.secondary === ab ? "secondary" : null;
          return (
            <AbilityRow
              key={ab}
              ab={ab}
              value={state.stats[ab]}
              race={state.race}
              options={pool}
              tier={tier}
              onPick={(v) => place(ab, v)}
              onClear={() => clear(ab)}
            />
          );
        })}
      </div>
    </div>
  );
}

function AbilityRow({
  ab,
  value,
  race,
  options,
  tier,
  onPick,
  onClear,
}: {
  ab: Ability;
  value: number;
  race: string;
  options: number[];
  tier: "primary" | "secondary" | null;
  onPick: (v: number) => void;
  onClear: () => void;
}) {
  const bump = applyRaceASI(race, { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 })[ab];
  const final = value > 0 ? value + bump : 0;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-tavern-night/50 px-3 py-2",
        tier === "primary"
          ? "border-tavern-gold/60"
          : tier === "secondary"
            ? "border-tavern-gold/30"
            : "border-tavern-stone/30",
      )}
    >
      <span className="font-heading text-xs uppercase tracking-[0.2em] text-tavern-parchment/85">
        {ABILITY_LABEL[ab]}
      </span>
      {tier && (
        <span
          aria-label={`${tier} recommendation`}
          title={`${tier} recommendation for the chosen play style`}
          className={cn(
            "ml-0.5 inline-block h-1.5 w-1.5 rounded-full",
            tier === "primary" ? "bg-tavern-gold" : "bg-tavern-gold/55",
          )}
        />
      )}
      <div className="ml-auto flex items-center gap-2">
        {bump > 0 && (
          <Chip tone="active" className="!px-1 !py-0">
            +{bump}
          </Chip>
        )}
        <div className="flex items-center gap-1">
          {value > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 min-w-[3rem] items-center justify-center rounded-md border border-tavern-gold/70 bg-tavern-gold/15 px-2 font-heading text-sm text-tavern-gold hover:bg-tavern-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
              aria-label={`Clear ${ABILITY_LABEL[ab]} (currently ${value}, total ${final})`}
            >
              {value}
              {bump > 0 && (
                <span className="ml-1 text-[0.6rem] text-tavern-parchment/80">
                  → {final}
                </span>
              )}
            </button>
          ) : (
            <PoolPicker ability={ab} options={options} onPick={onPick} />
          )}
        </div>
      </div>
    </div>
  );
}

function PoolPicker({
  ability,
  options,
  onPick,
}: {
  ability: Ability;
  options: number[];
  onPick: (v: number) => void;
}) {
  if (options.length === 0) {
    return (
      <span className="text-xs italic text-tavern-stone">empty</span>
    );
  }
  return (
    <select
      aria-label={`Pick a score for ${ABILITY_LABEL[ability]}`}
      defaultValue=""
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n > 0) onPick(n);
      }}
      className="h-8 rounded-md border border-tavern-stone/40 bg-tavern-night/70 px-2 text-xs text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
    >
      <option value="">pick…</option>
      {options.map((v, i) => (
        <option key={`${v}-${i}`} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}

// ---- point-buy editor ----

function PointBuyEditor({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  const used = useMemo(
    () =>
      ABILITIES.reduce((acc, ab) => acc + pointBuyCost(state.stats[ab] || 8), 0),
    [state.stats],
  );
  const remaining = 27 - used;

  function bump(ab: Ability, dir: 1 | -1) {
    const cur = state.stats[ab] || 8;
    const target = cur + dir;
    if (target < 8 || target > 15) return;
    const delta = pointBuyCost(target) - pointBuyCost(cur);
    if (delta > remaining) return;
    set({ stats: { ...state.stats, [ab]: target } });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-md border border-tavern-stone/30 bg-tavern-night/50 px-3 py-2">
        <span className="font-heading text-[0.65rem] uppercase tracking-[0.25em] text-tavern-parchment/70">
          points remaining
        </span>
        <span
          className={cn(
            "font-heading text-base",
            remaining === 0
              ? "text-tavern-gold"
              : remaining < 0
                ? "text-tavern-blood"
                : "text-tavern-parchment",
          )}
        >
          {remaining} / 27
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {ABILITIES.map((ab) => {
          const rec = recommendedAbilities(state.playStyle, state.char_class);
          const tier: "primary" | "secondary" | null =
            rec.primary === ab ? "primary" : rec.secondary === ab ? "secondary" : null;
          const base = state.stats[ab] || 8;
          const bumpV = applyRaceASI(state.race, {
            str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
          })[ab];
          const final = base + bumpV;
          return (
            <div
              key={ab}
              className={cn(
                "flex items-center gap-2 rounded-md border bg-tavern-night/50 px-3 py-2",
                tier === "primary"
                  ? "border-tavern-gold/60"
                  : tier === "secondary"
                    ? "border-tavern-gold/30"
                    : "border-tavern-stone/30",
              )}
            >
              <span className="font-heading text-xs uppercase tracking-[0.2em] text-tavern-parchment/85">
                {ABILITY_LABEL[ab]}
              </span>
              {tier && (
                <span
                  aria-label={`${tier} recommendation`}
                  className={cn(
                    "ml-0.5 inline-block h-1.5 w-1.5 rounded-full",
                    tier === "primary" ? "bg-tavern-gold" : "bg-tavern-gold/55",
                  )}
                />
              )}
              <div className="ml-auto flex items-center gap-1">
                {bumpV > 0 && (
                  <Chip tone="active" className="!px-1 !py-0">
                    +{bumpV}
                  </Chip>
                )}
                <button
                  type="button"
                  onClick={() => bump(ab, -1)}
                  disabled={base <= 8}
                  aria-label={`Decrease ${ABILITY_LABEL[ab]}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-tavern-stone/35 text-tavern-parchment/75 hover:border-tavern-gold/50 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md bg-tavern-night/70 font-heading text-sm text-tavern-parchment">
                  {base}
                  {bumpV > 0 && (
                    <span className="ml-1 text-[0.6rem] text-tavern-parchment/75">
                      → {final}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => bump(ab, 1)}
                  disabled={base >= 15 || pointBuyCost(base + 1) - pointBuyCost(base) > remaining}
                  aria-label={`Increase ${ABILITY_LABEL[ab]}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-tavern-stone/35 text-tavern-parchment/75 hover:border-tavern-gold/50 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- summary ----

function SummaryCard({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  const final = applyRaceASI(state.race, state.stats);
  const complete = ABILITIES.every((ab) =>
    state.statsMethod === "pointbuy" ? (state.stats[ab] || 0) >= 8 : state.stats[ab] > 0,
  );
  if (!complete) return null;
  const locked = state.locks.stats ?? false;
  return (
    <Card compact className="border-tavern-gold/30">
      <div className="grid grid-cols-6 gap-2 text-center">
        {ABILITIES.map((ab) => (
          <div key={ab}>
            <div className="font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
              {ABILITY_LABEL[ab]}
            </div>
            <div className="mt-1 font-heading text-lg text-tavern-gold">
              {final[ab]}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[0.65rem] italic text-tavern-parchment/55">
          {locked
            ? "final totals — bound to the sheet when you light the fire."
            : "final totals — offered as a suggestion; lock to bind them."}
        </p>
        <FieldLock
          locked={locked}
          onToggle={() =>
            set({ locks: { ...state.locks, stats: !locked } })
          }
          label="Ability scores"
          size="sm"
        />
      </div>
    </Card>
  );
}
