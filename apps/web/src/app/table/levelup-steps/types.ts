import type { Ability } from "@/lib/srd";

export type HpMethod = "max" | "avg" | "roll";

export interface HpPick {
  method: HpMethod;
  value: number;
}

export type AsiMode = "single" | "split" | "feat";

export interface AsiPick {
  mode: AsiMode;
  /** mode === "single": one ability gets +2. */
  singleAbility?: Ability;
  /** mode === "split": two abilities each get +1. */
  splitA?: Ability;
  splitB?: Ability;
  /** mode === "feat": a feat name (free-text; AI threads it into the sheet). */
  featName?: string;
}

export interface LevelUpState {
  fromLevel: number;
  target: number;
  charClass: string;
  /** Stats as they are on the current sheet (already include earlier ASIs). */
  baseStats: Record<Ability, number>;
  /** Currently-known spells (snapshot from sheet). */
  currentSpells: string[];
  /** Player picks. */
  asi: Record<number, AsiPick>;
  hp: Record<number, HpPick>;
  spellsAdded: string[];
  notes: string;
}

export function gainedLevels(from: number, to: number): number[] {
  const out: number[] = [];
  for (let l = from + 1; l <= to; l++) out.push(l);
  return out;
}

export function crossedAsiLevels(
  from: number,
  to: number,
  asiLevels: readonly number[],
): number[] {
  return asiLevels.filter((lvl) => lvl > from && lvl <= to);
}

export function applyAsiToStats(
  base: Record<Ability, number>,
  picks: Record<number, AsiPick>,
): Record<Ability, number> {
  const next = { ...base };
  for (const pick of Object.values(picks)) {
    if (pick.mode === "single" && pick.singleAbility) {
      next[pick.singleAbility] = Math.min(20, (next[pick.singleAbility] ?? 0) + 2);
    } else if (pick.mode === "split" && pick.splitA && pick.splitB) {
      next[pick.splitA] = Math.min(20, (next[pick.splitA] ?? 0) + 1);
      next[pick.splitB] = Math.min(20, (next[pick.splitB] ?? 0) + 1);
    }
    // feat mode doesn't change stats
  }
  return next;
}
