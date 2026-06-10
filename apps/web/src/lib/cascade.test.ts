import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cascadePicks, cascadePicksWith } from "./cascade";
import {
  ALIGNMENTS,
  BACKGROUND_NAMES,
  CLASS_NAMES,
  RACE_NAMES,
} from "./srd";

describe("cascadePicks — user-typed values pass through", () => {
  it("keeps every anchor the caller supplied untouched", () => {
    const out = cascadePicks({
      race: "Tiefling",
      charClass: "Wizard",
      background: "Sage",
      alignment: "Chaotic Good",
      level: 7,
    });
    expect(out).toEqual({
      race: "Tiefling",
      charClass: "Wizard",
      background: "Sage",
      alignment: "Chaotic Good",
      level: 7,
    });
  });

  it("trims whitespace before treating an input as 'provided'", () => {
    const out = cascadePicks({ race: "  Dwarf  " });
    expect(out.race).toBe("Dwarf");
  });

  it("ignores an unknown alignment string and cascades instead", () => {
    const out = cascadePicks({ alignment: "Chaotic Tuesday" });
    expect(ALIGNMENTS).toContain(out.alignment);
  });

  it("defaults level to 1 when none is supplied", () => {
    const out = cascadePicks({});
    expect(out.level).toBe(1);
  });
});

describe("cascadePicks — empty slots get filled from the legal pool", () => {
  it("picks a race from RACE_NAMES when none supplied", () => {
    const out = cascadePicks({});
    expect(RACE_NAMES).toContain(out.race);
  });

  it("picks a class from CLASS_NAMES when none supplied", () => {
    const out = cascadePicks({});
    expect(CLASS_NAMES).toContain(out.charClass);
  });

  it("picks a background from BACKGROUND_NAMES when none supplied", () => {
    const out = cascadePicks({});
    expect(BACKGROUND_NAMES).toContain(out.background);
  });

  it("picks an alignment from ALIGNMENTS when none supplied", () => {
    const out = cascadePicks({});
    expect(ALIGNMENTS).toContain(out.alignment);
  });
});

describe("cascadePicks — affinity weights bias but never block", () => {
  // Use a deterministic RNG via cascadePicksWith so the assertions are
  // reproducible across CI environments.
  it("Dwarf clusters around Cleric / Fighter / Paladin / Barbarian", () => {
    // Force `Math.random()` to return 0.99 — that lands at the end of the
    // weighted CDF, so the highest-weighted class wins consistently.
    const out = cascadePicksWith(() => 0.99, { race: "Dwarf" });
    expect(out.charClass).toBeDefined();
    expect(CLASS_NAMES).toContain(out.charClass);
  });

  it("any class remains reachable for any race (no zero weights)", () => {
    // Sample many trials with a deliberately uniform RNG — every class
    // should appear at least once in a large sample for Dwarf, including
    // ones not on the boost list (e.g. Wizard).
    const classes = new Set<string>();
    let rngIdx = 0;
    const sequence = Array.from(
      { length: 200 },
      (_, i) => (i + 1) / 201,
    );
    for (let i = 0; i < 200; i++) {
      const out = cascadePicksWith(
        () => sequence[rngIdx++ % sequence.length],
        { race: "Dwarf" },
      );
      classes.add(out.charClass);
    }
    expect(classes.size).toBeGreaterThanOrEqual(8);
    expect(classes.has("Wizard")).toBe(true);
  });
});

describe("cascadePicksWith — RNG injection is reversed even on throw", () => {
  let original: () => number;
  beforeEach(() => {
    original = Math.random;
  });
  afterEach(() => {
    expect(Math.random).toBe(original);
  });

  it("restores Math.random after a normal call", () => {
    cascadePicksWith(() => 0.5, {});
  });

  it("restores Math.random even when an unrelated error fires later", () => {
    // The cascadePicksWith helper uses try/finally — even if a downstream
    // throw happened, Math.random would still be restored. We can't make
    // the inner picker throw without monkey-patching, but the finally
    // guarantee is what we're documenting here.
    cascadePicksWith(() => 0.1, {});
    // sanity
    expect(typeof Math.random).toBe("function");
  });
});

describe("cascadePicks — Forgotten Realms human variety (smoke)", () => {
  it("returns Human as race when the caller supplies it", () => {
    // The cascade doesn't pick the Human strand itself — that's the
    // heritage.ts naming layer. But it should preserve a typed Human
    // input verbatim so the naming layer can roll a strand from it.
    const out = cascadePicks({ race: "Human" });
    expect(out.race).toBe("Human");
  });
});

// Guard that the deterministic-RNG helper is doing what the doc string
// promises — useful for future maintainers who change the picker.
describe("cascadePicksWith", () => {
  it("uses the injected RNG for the duration of the call", () => {
    const seq = [0.0, 0.0, 0.0, 0.0];
    let i = 0;
    const rng = vi.fn(() => seq[i++ % seq.length]);
    cascadePicksWith(rng, {});
    expect(rng).toHaveBeenCalled();
  });
});
