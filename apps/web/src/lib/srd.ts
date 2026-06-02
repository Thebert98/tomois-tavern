/**
 * Client-side mirror of SRD 5.1 data — enough for the Fireplace creation
 * wizard and the Round Table level-up wizard. The canonical source is
 * `services/.../ReRoll/backend/app/validator/srd_data.py`; everything here
 * is UX-only. Anything that gates a generation goes in the backend
 * validator and is enforced server-side.
 *
 * Keep this file in sync with the backend SRD constants. Where the data
 * diverges (e.g. spells), validator errors will surface inline in the UI
 * and the player can adjust.
 */

// ---- abilities -------------------------------------------------------------

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
export const ABILITY_LABEL: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

// ---- classes ---------------------------------------------------------------

export type CasterType = "full" | "half" | "pact" | "none";

export interface ClassInfo {
  caster: CasterType;
  /** Primary spellcasting ability (null for non-casters). */
  ability: Ability | null;
  hitDie: 6 | 8 | 10 | 12;
  /** D&D 5e prepared vs known. UX hint only. */
  prepared: boolean;
}

/** Mirrors CLASSES + HIT_DICE in srd_data.py. */
export const CLASS_INFO: Record<string, ClassInfo> = {
  Barbarian: { caster: "none", ability: null, hitDie: 12, prepared: false },
  Bard:      { caster: "full", ability: "cha", hitDie: 8, prepared: false },
  Cleric:    { caster: "full", ability: "wis", hitDie: 8, prepared: true },
  Druid:     { caster: "full", ability: "wis", hitDie: 8, prepared: true },
  Fighter:   { caster: "none", ability: null, hitDie: 10, prepared: false },
  Monk:      { caster: "none", ability: null, hitDie: 8, prepared: false },
  Paladin:   { caster: "half", ability: "cha", hitDie: 10, prepared: true },
  Ranger:    { caster: "half", ability: "wis", hitDie: 10, prepared: false },
  Rogue:     { caster: "none", ability: null, hitDie: 8, prepared: false },
  Sorcerer:  { caster: "full", ability: "cha", hitDie: 6, prepared: false },
  Warlock:   { caster: "pact", ability: "cha", hitDie: 8, prepared: false },
  Wizard:    { caster: "full", ability: "int", hitDie: 6, prepared: true },
};

export const CLASS_NAMES = Object.keys(CLASS_INFO);

/** Legacy export (CASTER_TYPES) kept for back-compat with existing callers. */
export const CASTER_TYPES: Record<string, CasterType> = Object.fromEntries(
  Object.entries(CLASS_INFO).map(([k, v]) => [k, v.caster]),
);

export const HIT_DICE: Record<string, string> = Object.fromEntries(
  Object.entries(CLASS_INFO).map(([k, v]) => [k, `d${v.hitDie}`]),
);

// ---- races -----------------------------------------------------------------

/** Mirrors RACES in srd_data.py. Map of race → ability score increase. */
export const RACES: Record<string, Partial<Record<Ability, number>>> = {
  "Hill Dwarf":         { con: 2, wis: 1 },
  "Mountain Dwarf":     { con: 2, str: 2 },
  "High Elf":           { dex: 2, int: 1 },
  "Wood Elf":           { dex: 2, wis: 1 },
  "Elf":                { dex: 2 },
  "Dwarf":              { con: 2 },
  "Lightfoot Halfling": { dex: 2, cha: 1 },
  "Halfling":           { dex: 2 },
  "Human":              { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  "Dragonborn":         { str: 2, cha: 1 },
  "Gnome":              { int: 2 },
  "Half-Elf":           { cha: 2 },
  "Half-Orc":           { str: 2, con: 1 },
  "Tiefling":           { int: 1, cha: 2 },
};
export const RACE_NAMES = Object.keys(RACES);

/** Apply a race's ASI on top of a base stats block. Returns a new block. */
export function applyRaceASI(
  race: string | null,
  base: Record<Ability, number>,
): Record<Ability, number> {
  const bumps = race ? RACES[race] : undefined;
  const out: Record<Ability, number> = { ...base };
  if (!bumps) return out;
  for (const ab of ABILITIES) {
    out[ab] = (out[ab] ?? 0) + (bumps[ab] ?? 0);
  }
  return out;
}

// ---- backgrounds -----------------------------------------------------------

/** Mirrors BACKGROUNDS in srd_data.py. */
export const BACKGROUNDS: Record<string, string[]> = {
  Acolyte:        ["Insight", "Religion"],
  Criminal:       ["Deception", "Stealth"],
  "Folk Hero":    ["Animal Handling", "Survival"],
  Noble:          ["History", "Persuasion"],
  Sage:           ["Arcana", "History"],
  Soldier:        ["Athletics", "Intimidation"],
  Charlatan:      ["Deception", "Sleight of Hand"],
  Entertainer:    ["Acrobatics", "Performance"],
  "Guild Artisan":["Insight", "Persuasion"],
  Hermit:         ["Medicine", "Religion"],
  Outlander:      ["Athletics", "Survival"],
  Urchin:         ["Sleight of Hand", "Stealth"],
};
export const BACKGROUND_NAMES = Object.keys(BACKGROUNDS);

// ---- alignments ------------------------------------------------------------

export const ALIGNMENTS = [
  "Lawful Good",   "Neutral Good",   "Chaotic Good",
  "Lawful Neutral","True Neutral",   "Chaotic Neutral",
  "Lawful Evil",   "Neutral Evil",   "Chaotic Evil",
] as const;
export type Alignment = (typeof ALIGNMENTS)[number];

// ---- spell slots + spells --------------------------------------------------

/**
 * Full-caster spell slot rows mirroring FULL_CASTER_SLOTS in srd_data.py.
 * Each row is `[1st, 2nd, 3rd, …]` slot counts. Length of the row is the
 * highest spell level the caster can cast.
 */
export const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1:  [2],
  2:  [3],
  3:  [4, 2],
  4:  [4, 3],
  5:  [4, 3, 2],
  6:  [4, 3, 3],
  7:  [4, 3, 3, 1],
  8:  [4, 3, 3, 2],
  9:  [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

export interface SpellInfo {
  level: number;
  classes: string[];
}

/**
 * SRD spell subset mirroring SPELLS in srd_data.py. The validator on the
 * backend is the source of truth — if the picker allows a spell the backend
 * rejects, the UI shows the error inline so the player can adjust.
 */
export const SPELLS: Record<string, SpellInfo> = {
  // ---- cantrips
  "Fire Bolt":         { level: 0, classes: ["Sorcerer", "Wizard"] },
  "Ray of Frost":      { level: 0, classes: ["Sorcerer", "Wizard"] },
  "Mage Hand":         { level: 0, classes: ["Bard", "Sorcerer", "Warlock", "Wizard"] },
  "Prestidigitation":  { level: 0, classes: ["Bard", "Sorcerer", "Warlock", "Wizard"] },
  "Sacred Flame":      { level: 0, classes: ["Cleric"] },
  Guidance:            { level: 0, classes: ["Cleric", "Druid"] },
  Druidcraft:          { level: 0, classes: ["Druid"] },
  "Produce Flame":     { level: 0, classes: ["Druid"] },
  Shillelagh:          { level: 0, classes: ["Druid"] },
  "Vicious Mockery":   { level: 0, classes: ["Bard"] },
  "Eldritch Blast":    { level: 0, classes: ["Warlock"] },
  Light:               { level: 0, classes: ["Bard", "Cleric", "Sorcerer", "Wizard"] },
  // ---- 1st level
  "Magic Missile":     { level: 1, classes: ["Sorcerer", "Wizard"] },
  Shield:              { level: 1, classes: ["Sorcerer", "Wizard"] },
  "Burning Hands":     { level: 1, classes: ["Sorcerer", "Wizard"] },
  "Cure Wounds":       { level: 1, classes: ["Bard", "Cleric", "Druid", "Paladin", "Ranger"] },
  "Healing Word":      { level: 1, classes: ["Bard", "Cleric", "Druid"] },
  Bless:               { level: 1, classes: ["Cleric", "Paladin"] },
  Entangle:            { level: 1, classes: ["Druid"] },
  "Faerie Fire":       { level: 1, classes: ["Bard", "Druid"] },
  Thunderwave:         { level: 1, classes: ["Bard", "Druid", "Sorcerer", "Wizard"] },
  Hex:                 { level: 1, classes: ["Warlock"] },
  "Hunters Mark":      { level: 1, classes: ["Ranger"] },
  // ---- 2nd level
  "Misty Step":        { level: 2, classes: ["Sorcerer", "Warlock", "Wizard"] },
  "Scorching Ray":     { level: 2, classes: ["Sorcerer", "Wizard"] },
  "Spiritual Weapon":  { level: 2, classes: ["Cleric"] },
  "Hold Person":       { level: 2, classes: ["Bard", "Cleric", "Druid", "Sorcerer", "Warlock", "Wizard"] },
  Moonbeam:            { level: 2, classes: ["Druid"] },
  "Lesser Restoration":{ level: 2, classes: ["Bard", "Cleric", "Druid", "Paladin", "Ranger"] },
  // ---- 3rd level
  Fireball:            { level: 3, classes: ["Sorcerer", "Wizard"] },
  Counterspell:        { level: 3, classes: ["Sorcerer", "Warlock", "Wizard"] },
  Fly:                 { level: 3, classes: ["Sorcerer", "Warlock", "Wizard"] },
  "Call Lightning":    { level: 3, classes: ["Druid"] },
  "Dispel Magic":      { level: 3, classes: ["Bard", "Cleric", "Druid", "Paladin", "Sorcerer", "Warlock", "Wizard"] },
  Revivify:            { level: 3, classes: ["Cleric", "Paladin"] },
  "Spirit Guardians":  { level: 3, classes: ["Cleric"] },
  // ---- 4th + 5th
  Polymorph:           { level: 4, classes: ["Bard", "Druid", "Sorcerer", "Wizard"] },
  "Ice Storm":         { level: 4, classes: ["Druid", "Sorcerer", "Wizard"] },
  "Greater Invisibility":{ level: 4, classes: ["Bard", "Sorcerer", "Wizard"] },
  "Cone of Cold":      { level: 5, classes: ["Sorcerer", "Wizard"] },
  "Mass Cure Wounds":  { level: 5, classes: ["Bard", "Cleric", "Druid"] },
  "Flame Strike":      { level: 5, classes: ["Cleric"] },
};

export type SpellWithName = SpellInfo & { name: string };

/** All spells legal for a class (no level filter), sorted by level then name. */
export function legalSpellsForClass(charClass: string): SpellWithName[] {
  const out: SpellWithName[] = [];
  for (const [name, info] of Object.entries(SPELLS)) {
    if (info.classes.includes(charClass)) out.push({ name, ...info });
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/** Spells of a specific level legal for a class. */
export function spellsForClassLevel(
  charClass: string,
  spellLevel: number,
): SpellWithName[] {
  return legalSpellsForClass(charClass).filter((s) => s.level === spellLevel);
}

// ---- derived / helpers -----------------------------------------------------

export const ASI_LEVELS = [4, 8, 12, 16, 19] as const;

export function proficiencyBonus(level: number): number {
  const safe = Math.max(1, Math.min(level, 20));
  return 2 + Math.floor((safe - 1) / 4);
}

/** Highest spell level castable at this class level. -1 for non-casters. */
export function maxSpellLevel(charClass: string, level: number): number {
  const caster = CLASS_INFO[charClass]?.caster ?? "none";
  if (caster === "none") return -1;
  if (caster === "pact") return Math.min(5, Math.ceil(level / 2));
  if (caster === "half") {
    if (level < 2) return 0;
    return Math.min(5, Math.ceil((level - 1) / 4) + 1);
  }
  // full caster
  const row = FULL_CASTER_SLOTS[Math.max(1, Math.min(20, level))] ?? [];
  return row.length;
}

export function isASILevel(level: number): boolean {
  return (ASI_LEVELS as readonly number[]).includes(level);
}

/**
 * Soft cap on the number of cantrips + leveled spells a class can know /
 * prepare at a given character level. Used by the SpellsStep picker to gate
 * how many checkboxes the player can tick. The backend validator
 * (`services/.../ReRoll/backend/app/validator/validator.py`) is the source
 * of truth for legality — these are pragmatic UX limits, not the rule.
 */
export function spellsKnownAt(
  charClass: string,
  level: number,
): { cantrips: number; spells: number } {
  const info = CLASS_INFO[charClass];
  if (!info || info.caster === "none") return { cantrips: 0, spells: 0 };
  const baseCantrips: Record<string, number> = {
    Bard: 2,
    Cleric: 3,
    Druid: 2,
    Sorcerer: 4,
    Wizard: 3,
    Warlock: 2,
  };
  const base = baseCantrips[charClass] ?? 0;
  const growth = level >= 17 ? 2 : level >= 10 ? 1 : level >= 4 ? 0 : 0;
  const cantrips = base + growth;
  let spells: number;
  if (info.caster === "half") {
    spells = level < 2 ? 0 : Math.max(2, Math.floor(level / 2) + 1);
  } else if (info.caster === "pact") {
    spells = Math.min(15, level + 1);
  } else if (info.prepared) {
    spells = level + 3;
  } else {
    spells = level + 2;
  }
  return { cantrips, spells };
}

// ---- stat method helpers ---------------------------------------------------

/** Standard array per the DMG. */
export function standardArray(): number[] {
  return [15, 14, 13, 12, 10, 8];
}

/**
 * Point-buy cost to RAISE an ability from 8 → `score`. Returns 0 below 8 and
 * Infinity above 15 (the SRD cap before racial bumps).
 */
export function pointBuyCost(score: number): number {
  // 8→9=1, 9→10=1, 10→11=1, 11→12=1, 12→13=1, 13→14=2, 14→15=2.
  if (score < 8) return 0;
  if (score > 15) return Number.POSITIVE_INFINITY;
  let cost = 0;
  for (let s = 9; s <= score; s++) {
    cost += s >= 14 ? 2 : 1;
  }
  return cost;
}

/** SRD-style 4d6 drop lowest. */
export function rollScore(): number {
  const rolls = [
    1 + Math.floor(Math.random() * 6),
    1 + Math.floor(Math.random() * 6),
    1 + Math.floor(Math.random() * 6),
    1 + Math.floor(Math.random() * 6),
  ];
  rolls.sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
}

// ---- level-up highlights (existing API) ------------------------------------

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

  const info = CLASS_INFO[charClass];
  if (info && info.caster !== "none") {
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

  for (const l of ASI_LEVELS) {
    if (l > fromLevel && l <= toLevel) {
      highlights.push(`Level ${l}: an Ability Score Improvement (or a feat).`);
    }
  }

  if (info) {
    highlights.push(`Roll d${info.hitDie} for hit points (max + CON modifier).`);
  }

  return highlights;
}
