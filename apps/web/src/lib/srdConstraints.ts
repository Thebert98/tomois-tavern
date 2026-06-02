/**
 * SRD constraint hint compiled from the resolved cascade anchors. Goes
 * into `user_notes` so the LLM has the hard rules in front of it before
 * it generates — reduces validator rejections.
 *
 * The backend validator (`backend/app/validator/validator.py`) checks:
 *   - class is in CLASSES
 *   - level 1-20
 *   - stats integers 3-20
 *   - race in RACES
 *   - background in BACKGROUNDS, and proficiencies include the background's
 *     granted skills when proficiencies are present
 *   - non-casters have empty spells, spells exist + are on the class list,
 *     spell level is within reach for the character level
 *
 * We can't change the validator without a backend redeploy, but we can
 * stop tripping it by putting the same constraints in the LLM's prompt.
 * The biggest offenders are background proficiencies (LLM forgets to
 * include the two granted skills) and spell list mismatches (LLM picks a
 * Cleric spell for a Druid, or a 3rd-level spell at character level 1).
 */

import {
  BACKGROUNDS,
  CLASS_INFO,
  legalSpellsForClass,
  maxSpellLevel,
} from "./srd";
import type { Anchors } from "./cascade";

/**
 * Build the constraint paragraph for a fully-resolved anchor set. Returns
 * empty string when there's nothing to add (e.g. unknown class).
 */
export function srdConstraintsFor(anchors: Anchors): string {
  const parts: string[] = [];

  // ---- Background → granted proficiencies -------------------------------
  const bgSkills = BACKGROUNDS[anchors.background];
  if (bgSkills && bgSkills.length > 0) {
    parts.push(
      `SRD background rule: the ${anchors.background} background grants ${bgSkills.join(
        " and ",
      )}. The proficiencies field MUST include both of those skills exactly as written.`,
    );
  }

  // ---- Class → caster type + spell list --------------------------------
  const cls = CLASS_INFO[anchors.charClass];
  if (cls) {
    if (cls.caster === "none") {
      parts.push(
        `SRD class rule: ${anchors.charClass} is a non-caster — the spells field MUST be an empty list [].`,
      );
    } else {
      const maxLvl = maxSpellLevel(anchors.charClass, anchors.level);
      const legal = legalSpellsForClass(anchors.charClass)
        .filter((s) => s.level <= maxLvl)
        .map((s) => s.name);
      if (legal.length > 0) {
        parts.push(
          `SRD class rule: at level ${anchors.level}, ${anchors.charClass} can cast spells up to level ${maxLvl}. Every entry in the spells field MUST be drawn from this list and no other: ${legal.join(
            ", ",
          )}.`,
        );
      } else {
        // Edge case: a class with no SRD spells at this level (e.g. a level-1
        // Paladin). Tell the LLM the field stays empty.
        parts.push(
          `SRD class rule: ${anchors.charClass} has no spell slots at character level ${anchors.level}. The spells field MUST be an empty list [].`,
        );
      }
    }
  }

  // ---- Stats range (defensive reminder) ---------------------------------
  parts.push(
    "SRD stats rule: every ability score must be an integer between 3 and 20 inclusive.",
  );

  return parts.join(" ");
}
