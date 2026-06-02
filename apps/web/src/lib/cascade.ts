/**
 * Structural cascade picker for the Fireplace.
 *
 * Fills the five anchor fields (race, class, background, alignment, level)
 * in dependency order using soft affinity weights:
 *
 *   race  →  class  →  background  →  alignment  →  level
 *
 * Weights are soft (2× / 3× the baseline) — every (race, class, background)
 * combination remains reachable; affinities just bias the random walk so
 * combinations cluster around what makes sense (Dwarf Cleric, Tiefling
 * Warlock) without forbidding the surprising ones (Dwarf Wizard).
 *
 * Empty / missing input fields cascade-fill from the wizard's available
 * pools. Provided values stay untouched — the user's pick anchors what's
 * around it.
 */

import {
  ALIGNMENTS,
  BACKGROUND_NAMES,
  CLASS_NAMES,
  RACE_NAMES,
  type Alignment,
} from "./srd";

// ---- affinity matrices ------------------------------------------------------

/**
 * Race → Class boosts. Listed classes get 2× weight when the cascade picks
 * a class for a given race; unlisted classes stay at baseline 1.
 *
 * Source: 5e PHB race chapter "Adventurers of the race" sub-sections.
 */
const RACE_CLASS_BOOSTS: Record<string, string[]> = {
  Dwarf:              ["Cleric", "Fighter", "Paladin", "Barbarian"],
  "Hill Dwarf":       ["Cleric", "Druid", "Bard"],
  "Mountain Dwarf":   ["Fighter", "Paladin", "Barbarian"],
  Elf:                ["Wizard", "Ranger", "Druid", "Bard"],
  "High Elf":         ["Wizard", "Bard", "Sorcerer"],
  "Wood Elf":         ["Ranger", "Druid", "Rogue"],
  Halfling:           ["Rogue", "Bard", "Sorcerer"],
  "Lightfoot Halfling": ["Rogue", "Bard", "Sorcerer"],
  Human:              [], // Humans are deliberately flat — every class equally plausible.
  Tiefling:           ["Warlock", "Sorcerer", "Bard"],
  "Half-Orc":         ["Barbarian", "Fighter"],
  Dragonborn:         ["Paladin", "Sorcerer", "Fighter"],
  Gnome:              ["Wizard", "Bard"],
  "Half-Elf":         ["Bard", "Sorcerer", "Warlock"],
};

/**
 * Class → Background boosts. The flagship background of each class gets a
 * 3× weight, secondary backgrounds 2×, and the rest 1×. (Backgrounds
 * carry the strongest narrative pull — they tell you why the character
 * ended up in their class.)
 */
const CLASS_BACKGROUND_BOOSTS: Record<string, { strong: string[]; weak: string[] }> = {
  Cleric:    { strong: ["Acolyte"], weak: ["Hermit", "Noble"] },
  Paladin:   { strong: ["Acolyte", "Soldier"], weak: ["Noble"] },
  Wizard:    { strong: ["Sage"], weak: ["Hermit", "Guild Artisan"] },
  Sorcerer:  { strong: ["Hermit"], weak: ["Charlatan", "Noble", "Outlander"] },
  Warlock:   { strong: ["Charlatan", "Hermit"], weak: ["Noble", "Sage"] },
  Fighter:   { strong: ["Soldier"], weak: ["Folk Hero", "Guild Artisan"] },
  Barbarian: { strong: ["Outlander"], weak: ["Folk Hero"] },
  Ranger:    { strong: ["Outlander"], weak: ["Folk Hero", "Hermit"] },
  Druid:     { strong: ["Hermit"], weak: ["Outlander"] },
  Bard:      { strong: ["Entertainer"], weak: ["Noble", "Charlatan"] },
  Rogue:     { strong: ["Criminal"], weak: ["Charlatan", "Urchin"] },
  Monk:      { strong: ["Hermit"], weak: ["Acolyte", "Urchin"] },
};

/**
 * Very soft alignment bias. Most characters land roughly neutral; some
 * archetypes lean a direction. We only nudge — never pin.
 */
function alignmentBias(race: string, charClass: string): Record<string, number> {
  const bias: Record<string, number> = {};

  // Class leanings.
  if (charClass === "Paladin") {
    bias["Lawful Good"] = 3;
    bias["Lawful Neutral"] = 1.5;
  } else if (charClass === "Cleric") {
    bias["Lawful Good"] = 2;
    bias["Neutral Good"] = 2;
  } else if (charClass === "Barbarian") {
    bias["Chaotic Neutral"] = 2.5;
    bias["Chaotic Good"] = 1.5;
    bias["Chaotic Evil"] = 1.5;
  } else if (charClass === "Druid") {
    bias["True Neutral"] = 2.5;
    bias["Neutral Good"] = 1.5;
  } else if (charClass === "Rogue") {
    bias["Chaotic Neutral"] = 2;
    bias["Chaotic Good"] = 1.5;
  } else if (charClass === "Warlock") {
    bias["Chaotic Neutral"] = 1.5;
    bias["Neutral Evil"] = 1.5;
  } else if (charClass === "Monk") {
    bias["Lawful Neutral"] = 2;
    bias["Lawful Good"] = 1.5;
  }

  // Race leanings (gentle).
  if (race === "Half-Orc") {
    bias["Chaotic Neutral"] = (bias["Chaotic Neutral"] ?? 1) + 0.5;
  } else if (race.includes("Dwarf")) {
    bias["Lawful Good"] = (bias["Lawful Good"] ?? 1) + 0.5;
    bias["Lawful Neutral"] = (bias["Lawful Neutral"] ?? 1) + 0.3;
  } else if (race.includes("Elf")) {
    bias["Chaotic Good"] = (bias["Chaotic Good"] ?? 1) + 0.3;
  } else if (race === "Tiefling") {
    bias["Chaotic Neutral"] = (bias["Chaotic Neutral"] ?? 1) + 0.4;
  } else if (race === "Halfling" || race === "Lightfoot Halfling") {
    bias["Neutral Good"] = (bias["Neutral Good"] ?? 1) + 0.5;
  }

  return bias;
}

// ---- weighted picker --------------------------------------------------------

function weightedPick<T>(items: readonly T[], weight: (item: T) => number): T {
  let total = 0;
  const weights: number[] = [];
  for (const item of items) {
    const w = Math.max(0, weight(item));
    weights.push(w);
    total += w;
  }
  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)];
  }
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---- public API -------------------------------------------------------------

export interface Anchors {
  race: string;
  charClass: string;
  background: string;
  alignment: Alignment;
  level: number;
}

export interface CascadeInput {
  race?: string | null;
  charClass?: string | null;
  background?: string | null;
  alignment?: string | null;
  level?: number | null;
}

/**
 * Cascade-fill any empty anchors. User-provided values pass through
 * untouched; only missing slots get a weighted random pick informed by the
 * slots already chosen above them in the dependency order.
 */
export function cascadePicks(input: CascadeInput): Anchors {
  const race =
    (input.race && input.race.trim()) ||
    weightedPick(RACE_NAMES, () => 1);

  const charClass =
    (input.charClass && input.charClass.trim()) ||
    weightedPick(CLASS_NAMES, (c) =>
      RACE_CLASS_BOOSTS[race]?.includes(c) ? 2 : 1,
    );

  const bgBoost = CLASS_BACKGROUND_BOOSTS[charClass];
  const background =
    (input.background && input.background.trim()) ||
    weightedPick(BACKGROUND_NAMES, (b) => {
      if (!bgBoost) return 1;
      if (bgBoost.strong.includes(b)) return 3;
      if (bgBoost.weak.includes(b)) return 2;
      return 1;
    });

  const bias = alignmentBias(race, charClass);
  const alignment =
    (input.alignment && input.alignment.trim() && (ALIGNMENTS as readonly string[]).includes(input.alignment.trim())
      ? (input.alignment.trim() as Alignment)
      : null) ||
    weightedPick(ALIGNMENTS, (a) => bias[a] ?? 1);

  const level =
    typeof input.level === "number" && input.level >= 1 ? input.level : 1;

  return { race, charClass, background, alignment, level };
}

/**
 * For QA — pure-function alternative when the caller wants to inject a
 * specific PRNG (e.g. /design preview). Optional; not used in production.
 */
export function cascadePicksWith(rng: () => number, input: CascadeInput): Anchors {
  const original = Math.random;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Math as any).random = rng;
  try {
    return cascadePicks(input);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Math as any).random = original;
  }
}
