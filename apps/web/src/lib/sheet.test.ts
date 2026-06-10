import { describe, it, expect } from "vitest";
import {
  getField,
  setField,
  setFields,
  lockedSheetFrom,
  sheetFromPicks,
  fieldValue,
} from "./sheet";

describe("getField", () => {
  it("returns a fallback when the key is missing", () => {
    expect(getField({}, "name")).toEqual({ value: null });
    expect(getField(undefined, "name")).toEqual({ value: null });
  });

  it("returns the wrapped field shape when present", () => {
    const sheet = { name: { value: "Aerith", locked: true } };
    expect(getField(sheet, "name")).toEqual({ value: "Aerith", locked: true });
  });

  it("treats a non-object raw value as missing", () => {
    // Defensive: a stray bare value shouldn't crash callers.
    const sheet = { name: "Aerith" } as unknown as Record<string, unknown>;
    expect(getField(sheet, "name")).toEqual({ value: null });
  });
});

describe("setField", () => {
  it("creates a fresh cell when the key is new", () => {
    const out = setField({}, "name", { value: "Aerith", locked: true });
    expect(out).toEqual({ name: { value: "Aerith", locked: true } });
  });

  it("merges into an existing cell instead of replacing", () => {
    const before = { name: { value: "Aerith", source: "user" } };
    const after = setField(before, "name", { locked: true });
    expect(after.name).toEqual({
      value: "Aerith",
      source: "user",
      locked: true,
    });
  });

  it("does not mutate the input sheet", () => {
    const before = { name: { value: "Aerith" } };
    setField(before, "name", { locked: true });
    expect(before.name).toEqual({ value: "Aerith" });
  });
});

describe("setFields", () => {
  it("applies many patches in one pass", () => {
    const out = setFields(
      {},
      {
        name: { value: "Aerith", locked: true },
        race: { value: "Hill Dwarf" },
      },
    );
    expect(out).toEqual({
      name: { value: "Aerith", locked: true },
      race: { value: "Hill Dwarf" },
    });
  });
});

describe("lockedSheetFrom", () => {
  it("locks every present pick", () => {
    const out = lockedSheetFrom({ name: "Aerith", level: 3 });
    expect(out).toEqual({
      name: { value: "Aerith", locked: true },
      level: { value: 3, locked: true },
    });
  });

  it("skips null / undefined / empty-string / empty-array entries", () => {
    const out = lockedSheetFrom({
      name: "",
      race: null,
      char_class: undefined,
      spells: [],
      level: 1,
    });
    expect(out).toEqual({ level: { value: 1, locked: true } });
  });
});

describe("sheetFromPicks (per-field lock)", () => {
  it("locks only the keys the locks map says to lock", () => {
    const out = sheetFromPicks(
      { name: "Aerith", race: "Hill Dwarf", level: 3 },
      { name: true, race: false }, // `level` omitted → defaults to unlocked
    );
    expect(out).toEqual({
      name: { value: "Aerith", locked: true },
      race: { value: "Hill Dwarf", locked: false },
      level: { value: 3, locked: false },
    });
  });

  it("skips empties just like lockedSheetFrom does", () => {
    const out = sheetFromPicks({ name: "" }, { name: true });
    expect(out).toEqual({});
  });

  it("a typed-but-unlocked value is a SUGGESTION, not a constraint", () => {
    // This is the R3 PR 7 contract — codified here so a future PR that
    // accidentally flips the default to locked: true breaks the test.
    const out = sheetFromPicks({ race: "Tiefling" }, {});
    expect(out.race).toEqual({ value: "Tiefling", locked: false });
  });
});

describe("fieldValue", () => {
  it("returns the wrapped value as the requested type", () => {
    const sheet = { level: { value: 5 } };
    expect(fieldValue<number>(sheet, "level")).toBe(5);
  });

  it("returns null for a missing key (getField's empty cell sentinel)", () => {
    // getField returns {value: null} when the cell is absent; fieldValue
    // surfaces that null directly so callers can distinguish 'no cell'
    // from 'cell with value undefined' if they care.
    expect(fieldValue(undefined, "level")).toBeNull();
  });
});
