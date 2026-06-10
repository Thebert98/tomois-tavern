import { describe, it, expect } from "vitest";
import { namingConventionFor, heritageRaces } from "./heritage";

describe("namingConventionFor — returns empty for unknown / blank race", () => {
  it("returns '' for null / undefined / empty string", () => {
    expect(namingConventionFor(null)).toBe("");
    expect(namingConventionFor(undefined)).toBe("");
    expect(namingConventionFor("")).toBe("");
    expect(namingConventionFor("   ")).toBe("");
  });

  it("returns '' for a race that isn't in the heritage table", () => {
    expect(namingConventionFor("Yuan-Ti Pureblood")).toBe("");
  });
});

describe("namingConventionFor — known races emit a usable prompt paragraph", () => {
  it("includes the blurb and a 'Names in this tradition' line for Dwarf", () => {
    const text = namingConventionFor("Dwarf");
    expect(text).toMatch(/Naming convention:/);
    expect(text).toMatch(/Norse-rooted/);
    expect(text).toMatch(/Names in this tradition:/);
    // The terminal instruction must be present so the LLM doesn't
    // restate the guidance in its output.
    expect(text).toMatch(/Do not restate/);
  });

  it("includes family-name samples when the race has them", () => {
    const text = namingConventionFor("Dwarf");
    expect(text).toMatch(/Family or virtue names include:/);
    expect(text).toMatch(/Battlehammer|Ironfist|Fireforge/);
  });

  it("Tiefling text mentions virtue names or infernal-rooted names", () => {
    const text = namingConventionFor("Tiefling");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/virtue|infernal|Akmenos|Hope/i);
  });
});

describe("namingConventionFor — Human picks a Forgotten Realms strand", () => {
  it("returns a non-empty paragraph for Human", () => {
    const text = namingConventionFor("Human");
    expect(text).toMatch(/Naming convention/);
    expect(text).toMatch(/cultural background/);
  });

  it("repeated calls can sample different strands (smoke)", () => {
    // We don't assert a specific strand because the pick is random;
    // we assert only that the returned paragraph is well-formed.
    for (let i = 0; i < 5; i++) {
      const text = namingConventionFor("Human");
      expect(text).toMatch(/Names in this tradition:/);
    }
  });
});

describe("heritageRaces", () => {
  it("returns every race the heritage table knows about", () => {
    const races = heritageRaces();
    expect(races).toContain("Dwarf");
    expect(races).toContain("Elf");
    expect(races).toContain("Tiefling");
    expect(races).toContain("Human");
  });
});
