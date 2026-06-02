/**
 * Magic Mirror portrait prompt builder.
 *
 * Pulls everything the sheet knows — race, class, level, background,
 * alignment, personality, backstory, equipment, spells, stats — and
 * distills it into a Flux 1.1 Pro prompt. The previous version only
 * listed race + class + background + alignment, so the painted face
 * rarely reflected the character we actually rolled.
 *
 * The frontend builds the prompt and the player can edit before casting;
 * the workshop API just forwards the text to fal.ai. No negative-prompt
 * channel exists on Flux Pro Ultra, so style guards go in the positive
 * prompt as natural language ("painterly, not photo-realistic; no text,
 * no watermarks…").
 */

interface SheetField {
  value?: unknown;
  locked?: boolean;
  source?: string;
}

type Sheet = Record<string, unknown>;

function readString(sheet: Sheet, key: string): string {
  const f = sheet[key] as SheetField | undefined;
  return typeof f?.value === "string" ? f.value.trim() : "";
}

function readNumber(sheet: Sheet, key: string): number | null {
  const f = sheet[key] as SheetField | undefined;
  if (typeof f?.value === "number") return f.value;
  if (typeof f?.value === "string" && f.value.trim()) {
    const n = Number(f.value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readArray(sheet: Sheet, key: string): string[] {
  const f = sheet[key] as SheetField | undefined;
  if (!Array.isArray(f?.value)) return [];
  return f.value.filter((v): v is string => typeof v === "string");
}

function readStats(sheet: Sheet): Record<string, number> | null {
  const f = sheet["stats"] as SheetField | undefined;
  if (!f?.value || typeof f.value !== "object") return null;
  return f.value as Record<string, number>;
}

/**
 * Trim a long block to a concise visual cue. Prefer cutting at sentence
 * boundaries so the LLM-generated text stays grammatical. Returns the
 * input unchanged if already short.
 */
function distill(text: string, maxChars: number): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
  );
  if (lastSentence > maxChars * 0.5) return slice.slice(0, lastSentence + 1);
  const lastComma = slice.lastIndexOf(", ");
  if (lastComma > maxChars * 0.6) return slice.slice(0, lastComma) + ".";
  return slice.trim() + "…";
}

const ARMOR_RX = /\b(armor|armour|chainmail|chain mail|leather|plate|robe|robes|cloak|cape|hide|breastplate|scale mail|gambeson|tunic|hauberk|vestments|garb)\b/i;
const WEAPON_RX = /\b(sword|longsword|shortsword|greatsword|axe|battleaxe|handaxe|bow|longbow|shortbow|staff|quarterstaff|wand|dagger|hammer|warhammer|mace|spear|lance|whip|crossbow|scimitar|rapier|glaive|halberd|flail|sling|club|trident|sickle|javelin)\b/i;
const FOCUS_RX = /\b(holy symbol|amulet|orb|crystal|focus|component pouch|spellbook|tome|relic|talisman|charm)\b/i;
const SHIELD_RX = /\bshield\b/i;

function firstMatch(items: string[], rx: RegExp): string {
  for (const item of items) {
    if (rx.test(item)) return item;
  }
  return "";
}

/** Translate alignment into a one-word mood word for the portrait. */
function alignmentMood(alignment: string): string {
  const a = alignment.toLowerCase();
  if (a.includes("evil")) return "menacing";
  if (a.includes("good")) return "noble";
  if (a.includes("chaotic")) return "fierce";
  if (a.includes("lawful")) return "steadfast";
  return "";
}

/**
 * Translate stats into a physique cue. We only flag standouts — average
 * stats produce no line.
 */
function statsCue(stats: Record<string, number> | null): string {
  if (!stats) return "";
  const bits: string[] = [];
  if ((stats.str ?? 10) >= 16) bits.push("powerfully built");
  else if ((stats.str ?? 10) <= 8) bits.push("slight frame");
  if ((stats.dex ?? 10) >= 16) bits.push("lithe and quick");
  if ((stats.con ?? 10) >= 16) bits.push("hard-weathered");
  if ((stats.int ?? 10) >= 16) bits.push("keen-eyed and watchful");
  if ((stats.wis ?? 10) >= 16) bits.push("calm and observant");
  if ((stats.cha ?? 10) >= 16) bits.push("magnetic presence");
  return bits.slice(0, 2).join(", ");
}

/** Class iconography that shows in a portrait. */
function classIconography(charClass: string): string {
  const cls = charClass.toLowerCase();
  switch (cls) {
    case "cleric":
      return "holy symbol at the throat, faint divine glow on the brow";
    case "paladin":
      return "polished armor catching the light, oath-mark visible";
    case "wizard":
      return "ink-stained fingers, spellbook tucked under one arm";
    case "sorcerer":
      return "subtle wild magic crackle behind the eyes";
    case "warlock":
      return "patron's mark hidden on the skin, otherworldly hint in the gaze";
    case "druid":
      return "leaves and twigs woven into hair, weathered skin";
    case "bard":
      return "instrument slung over the shoulder, a half-smile";
    case "ranger":
      return "weather-stained cloak, a hawk's gaze";
    case "rogue":
      return "shadowed hood, knowing smirk";
    case "fighter":
      return "scarred hands, soldier's bearing";
    case "barbarian":
      return "tribal markings, wind-tangled hair, untamed energy";
    case "monk":
      return "calloused knuckles, centered stillness";
    default:
      return "";
  }
}

const STYLE_TAIL = [
  "Painterly fantasy oil-painting style with visible brushwork",
  "warm tavern firelight from one side casting dramatic shadows",
  "head-and-shoulders composition with the subject looking just past the viewer",
  "rich earth tones with gold and amber highlights",
  "highly detailed face and clothing, atmospheric background suggesting their world",
  "single subject only, no text, no watermarks, no modern attire, not anime, not cartoon",
].join(", ");

export interface PortraitPromptInputs {
  name: string;
  sheet: Sheet;
}

/**
 * Build a Flux-friendly portrait prompt from a character. Falls back to
 * generic adventurer copy when the sheet is sparse — never throws.
 */
export function buildPortraitPrompt({ name, sheet }: PortraitPromptInputs): string {
  const race = readString(sheet, "race");
  const charClass = readString(sheet, "char_class");
  const background = readString(sheet, "background");
  const alignment = readString(sheet, "alignment");
  const level = readNumber(sheet, "level");
  const personality = readString(sheet, "personality");
  const backstory = readString(sheet, "backstory");
  const equipment = readArray(sheet, "equipment");
  const spells = readArray(sheet, "spells");
  const stats = readStats(sheet);

  // ---- Subject line --------------------------------------------------------
  const subjectBits: string[] = [];
  subjectBits.push(`Portrait of ${name || "an adventurer"}`);
  const raceClass = [race, charClass].filter(Boolean).join(" ");
  if (raceClass) subjectBits.push(`a ${raceClass.toLowerCase()}`);
  if (typeof level === "number" && level > 0) {
    if (level >= 15) subjectBits.push("legendary, scarred from countless battles");
    else if (level >= 8) subjectBits.push("seasoned and confident");
    else if (level >= 4) subjectBits.push("proven in their first campaigns");
    else subjectBits.push("still finding their footing");
  }
  if (background) subjectBits.push(`once a ${background.toLowerCase()}`);
  const mood = alignmentMood(alignment);
  if (mood) subjectBits.push(mood);
  const physique = statsCue(stats);
  if (physique) subjectBits.push(physique);

  // ---- Equipment ----------------------------------------------------------
  const armor = firstMatch(equipment, ARMOR_RX);
  const weapon = firstMatch(equipment, WEAPON_RX);
  const focus = firstMatch(equipment, FOCUS_RX);
  const shield = firstMatch(equipment, SHIELD_RX);
  const gearBits: string[] = [];
  if (armor) gearBits.push(`wearing ${armor.toLowerCase()}`);
  if (weapon) gearBits.push(`a ${weapon.toLowerCase()} at hand`);
  if (shield) gearBits.push("shield slung over the back");
  if (focus) gearBits.push(`a ${focus.toLowerCase()} close at hand`);

  // ---- Class iconography --------------------------------------------------
  const iconography = classIconography(charClass);

  // ---- Spells (if caster) -------------------------------------------------
  const spellLine =
    spells.length > 0
      ? `their hands hint at the magic they wield (${spells.slice(0, 3).join(", ").toLowerCase()})`
      : "";

  // ---- Personality cue ----------------------------------------------------
  const personalityCue = distill(personality, 140);
  const personalityLine = personalityCue
    ? `Expression and bearing reflect their nature: ${personalityCue}`
    : "";

  // ---- Backstory cue ------------------------------------------------------
  const backstoryCue = distill(backstory, 260);
  const backstoryLine = backstoryCue ? `Their story shows in their face: ${backstoryCue}` : "";

  // ---- Assemble -----------------------------------------------------------
  const parts: string[] = [];
  parts.push(subjectBits.filter(Boolean).join(", ") + ".");
  if (gearBits.length) parts.push(gearBits.join(", ") + ".");
  if (iconography) parts.push(iconography + ".");
  if (spellLine) parts.push(spellLine + ".");
  if (personalityLine) parts.push(personalityLine + (personalityLine.endsWith(".") ? "" : "."));
  if (backstoryLine) parts.push(backstoryLine + (backstoryLine.endsWith(".") ? "" : "."));
  parts.push(STYLE_TAIL + ".");

  return parts.join(" ");
}
