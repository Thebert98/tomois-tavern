import { describe, it, expect } from "vitest";
import { srdConstraintsFor } from "./srdConstraints";

describe("srdConstraintsFor — background granted skills", () => {
  it("lists Acolyte's two granted skills", () => {
    const text = srdConstraintsFor({
      race: "Hill Dwarf",
      charClass: "Cleric",
      background: "Acolyte",
      alignment: "Lawful Good",
      level: 3,
    });
    expect(text).toMatch(/Insight/);
    expect(text).toMatch(/Religion/);
    expect(text).toMatch(/MUST include/);
  });

  it("lists Outlander's skills for a Barbarian", () => {
    const text = srdConstraintsFor({
      race: "Half-Orc",
      charClass: "Barbarian",
      background: "Outlander",
      alignment: "Chaotic Neutral",
      level: 1,
    });
    expect(text).toMatch(/Athletics/);
    expect(text).toMatch(/Survival/);
  });
});

describe("srdConstraintsFor — class spell list", () => {
  it("forbids spells for a Barbarian (non-caster)", () => {
    const text = srdConstraintsFor({
      race: "Half-Orc",
      charClass: "Barbarian",
      background: "Outlander",
      alignment: "Chaotic Neutral",
      level: 5,
    });
    expect(text).toMatch(/non-caster/);
    expect(text).toMatch(/empty list \[\]/);
  });

  it("includes only Cleric-legal spells for a Cleric", () => {
    const text = srdConstraintsFor({
      race: "Hill Dwarf",
      charClass: "Cleric",
      background: "Acolyte",
      alignment: "Lawful Good",
      level: 5,
    });
    // A Cleric should see Sacred Flame on its legal list and NOT see
    // Fireball (Wizard/Sorcerer only).
    expect(text).toMatch(/Sacred Flame/);
    expect(text).not.toMatch(/Fireball/);
  });

  it("caps spell level by character level (Wizard 1 cannot see Fireball)", () => {
    const text = srdConstraintsFor({
      race: "High Elf",
      charClass: "Wizard",
      background: "Sage",
      alignment: "Lawful Neutral",
      level: 1,
    });
    expect(text).toMatch(/level 1/);
    expect(text).not.toMatch(/Fireball/);
  });

  it("level-1 Paladin has no spell slots — empty list constraint", () => {
    const text = srdConstraintsFor({
      race: "Dragonborn",
      charClass: "Paladin",
      background: "Soldier",
      alignment: "Lawful Good",
      level: 1,
    });
    expect(text).toMatch(/empty list \[\]/);
  });
});

describe("srdConstraintsFor — defensive stats reminder", () => {
  it("always appends the 3-20 stats range note", () => {
    const text = srdConstraintsFor({
      race: "Human",
      charClass: "Fighter",
      background: "Soldier",
      alignment: "True Neutral",
      level: 1,
    });
    expect(text).toMatch(/3 and 20/);
  });
});
