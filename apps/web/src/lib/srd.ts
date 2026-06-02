/**
 * Minimal client-side mirror of SRD 5.1 data — just enough to power the
 * Round Table's level-up "what's new" panel. The canonical source is
 * `services/.../ReRoll/backend/app/validator/srd_data.py`; this file
 * deliberately stays small to reduce drift. Anything UX-only goes here;
 * anything that gates a generation goes in the backend validator.
 *
 * If you add a class/race/spell here, update the backend too (or rather:
 * the other way around — backend wins).
 */

export type CasterType = "full" | "half" | "pact" | "none";

/** Per-class spellcasting profile. */
export const CASTER_TYPES: Record<string, CasterType> = {
  Barbarian: "none",
  Bard: "full",
  Cleric: "full",
  Druid: "full",
  Fighter: "none",
  Monk: "none",
  Paladin: "half",
  Ranger: "half",
  Rogue: "none",
  Sorcerer: "full",
  Warlock: "pact",
  Wizard: "full",
};

/** Levels at which D&D 5e gives an Ability Score Improvement (or feat). */
export const ASI_LEVELS = [4, 8, 12, 16, 19] as const;

/** Linear class-level → proficiency bonus. Matches `srd_data.proficiency_bonus`. */
export function proficiencyBonus(level: number): number {
  const safe = Math.max(1, Math.min(level, 20));
  return 2 + Math.floor((safe - 1) / 4);
}

/**
 * Max spell level a character can cast at the given class level.
 * Returns -1 for non-casters. Mirrors `srd_data.max_spell_level`.
 */
export function maxSpellLevel(charClass: string, level: number): number {
  const caster = CASTER_TYPES[charClass] ?? "none";
  if (caster === "none") return -1;
  if (caster === "pact") return Math.min(5, Math.ceil(level / 2));
  if (caster === "half") {
    if (level < 2) return 0;
    return Math.min(5, Math.ceil((level - 1) / 4) + 1);
  }
  // full caster: roughly ceil(level/2), capped at 9.
  return Math.min(9, Math.ceil(level / 2));
}

export function isASILevel(level: number): boolean {
  return (ASI_LEVELS as readonly number[]).includes(level);
}

/** Hit-die hint per class. UX flavor only; backend doesn't enforce hp. */
export const HIT_DICE: Record<string, string> = {
  Barbarian: "d12",
  Fighter: "d10",
  Paladin: "d10",
  Ranger: "d10",
  Bard: "d8",
  Cleric: "d8",
  Druid: "d8",
  Monk: "d8",
  Rogue: "d8",
  Warlock: "d8",
  Sorcerer: "d6",
  Wizard: "d6",
};

/**
 * Describe what changes from `fromLevel` → `toLevel` for the given class.
 * Returns an array of one-line strings the UI can render as a list. Pure
 * function; no I/O. Empty when there's nothing meaningful to highlight.
 */
export function levelUpHighlights(
  charClass: string | null,
  fromLevel: number,
  toLevel: number,
): string[] {
  if (!charClass || toLevel <= fromLevel) return [];
  const highlights: string[] = [];

  const pbFrom = proficiencyBonus(fromLevel);
  const pbTo = proficiencyBonus(toLevel);
  if (pbTo !== pbFrom) {
    highlights.push(`Proficiency bonus: +${pbFrom} → +${pbTo}.`);
  }

  const caster = CASTER_TYPES[charClass];
  if (caster && caster !== "none") {
    const slotFrom = maxSpellLevel(charClass, fromLevel);
    const slotTo = maxSpellLevel(charClass, toLevel);
    if (slotTo > slotFrom) {
      highlights.push(
        `Spell slots unlocked: up to level ${slotTo} spells (was ${
          slotFrom < 1 ? "cantrips only" : slotFrom
        }).`,
      );
    }
  }

  // Crossed an ASI/feat window during the level range.
  for (const l of ASI_LEVELS) {
    if (l > fromLevel && l <= toLevel) {
      highlights.push(
        `Level ${l}: an Ability Score Improvement (or a feat).`,
      );
    }
  }

  const hit = HIT_DICE[charClass];
  if (hit) {
    highlights.push(`Roll ${hit} for hit points (max + CON modifier).`);
  }

  return highlights;
}
