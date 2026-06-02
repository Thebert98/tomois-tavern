import { CLASS_INFO, type Ability } from "./srd";

/**
 * Play-style stance picked once per Fireplace flow and once per LevelUp
 * climb. Influences:
 *  - StatsStep: a "recommended" dot is shown next to the abilities the
 *    stance favors (UI hint only — never enforced).
 *  - ASIStep (LevelUp): the recommended ability is highlighted when the
 *    player's bump matches.
 *  - `/generate` payload: `playStylePromptPrefix(style)` is prepended to
 *    the user's vibe / notes so the LLM threads the stance through the
 *    generated sheet.
 *
 * Single source of truth — backend pipeline doesn't know about play
 * styles directly; it just reads the prompt prefix.
 */

export type PlayStyle = "balanced" | "support" | "tank" | "damage" | "lore";

export interface PlayStyleInfo {
  id: PlayStyle;
  label: string;
  /** One-line picker blurb. */
  blurb: string;
  /** Optional emoji-free icon name (lucide-react) shown in the picker. */
  icon: "scale" | "heart-pulse" | "shield" | "swords" | "scroll-text";
}

export const PLAY_STYLES: PlayStyleInfo[] = [
  {
    id: "balanced",
    label: "Balanced",
    blurb: "No special bias — the fire weighs everything evenly.",
    icon: "scale",
  },
  {
    id: "support",
    label: "Support",
    blurb: "Healing, buffs, utility — keep the table standing.",
    icon: "heart-pulse",
  },
  {
    id: "tank",
    label: "Tanky",
    blurb: "AC, HP, and concentration — soak the hits for the party.",
    icon: "shield",
  },
  {
    id: "damage",
    label: "Damage",
    blurb: "Optimize output — burst, sustain, or both, by class.",
    icon: "swords",
  },
  {
    id: "lore",
    label: "True to lore",
    blurb: "The backstory steers — stats and choices follow who they are.",
    icon: "scroll-text",
  },
];

const DEX_MARTIAL = new Set(["Monk", "Rogue", "Ranger"]);

/**
 * Recommended abilities for a stance, given the class. Returns an empty
 * object for `balanced` / `lore` and for unknown classes.
 *
 * - support: WIS primary (CHA primary for Bard / Sorcerer).
 * - tank: CON primary, STR or DEX secondary based on class melee style.
 * - damage: class primary spellcasting ability, OR martial mainstat.
 */
export function recommendedAbilities(
  style: PlayStyle,
  charClass: string,
): { primary?: Ability; secondary?: Ability } {
  if (style === "balanced" || style === "lore") return {};
  if (style === "support") {
    if (charClass === "Bard" || charClass === "Sorcerer") {
      return { primary: "cha", secondary: "wis" };
    }
    return { primary: "wis", secondary: "cha" };
  }
  if (style === "tank") {
    return {
      primary: "con",
      secondary: DEX_MARTIAL.has(charClass) ? "dex" : "str",
    };
  }
  if (style === "damage") {
    const casterAbility = CLASS_INFO[charClass]?.ability;
    if (casterAbility) return { primary: casterAbility, secondary: "con" };
    return {
      primary: DEX_MARTIAL.has(charClass) ? "dex" : "str",
      secondary: "con",
    };
  }
  return {};
}

/**
 * Sentence prepended to the user's vibe / notes on `/generate`. The LLM
 * reads it as the dominant stance signal; empty for balanced.
 */
export function playStylePromptPrefix(style: PlayStyle): string {
  switch (style) {
    case "support":
      return "Play style: support / healer / buffer — favor utility, healing, and party-bolstering choices. ";
    case "tank":
      return "Play style: tank / defender — favor AC, HP, concentration-friendly choices, and frontline durability. ";
    case "damage":
      return "Play style: damage-optimized — favor high-output choices appropriate to the class (DPR, burst, or sustained). ";
    case "lore":
      return "Play style: stay true to the character's backstory and vibe — let who they are drive stat priorities, spell picks, equipment flavor, and personality. ";
    case "balanced":
    default:
      return "";
  }
}
