/**
 * Shared `{value, locked, source}` field accessors for ReRoll's sheet shape.
 *
 * Every sheet cell on ReRoll's backend is wrapped in `Field` (see
 * `services/.../ReRoll/backend/app/models/character.py` lines 24-27). The
 * frontend reads/writes these wrappers; this module is the single place
 * that knows the wrapping convention.
 *
 * Used by:
 *   - apps/web/src/app/table/EditCharacterModal.tsx
 *   - apps/web/src/app/fireplace/FireplaceWizard.tsx (planned)
 *   - apps/web/src/app/table/LevelUpWizard.tsx (planned)
 */

export type Sheet = Record<string, unknown>;

export interface SheetField {
  value: unknown;
  locked?: boolean;
  source?: string;
}

/** Read a field. Returns `{value: null}` when absent. */
export function getField(sheet: Sheet | null | undefined, key: string): SheetField {
  const raw = sheet?.[key];
  if (raw && typeof raw === "object") return raw as SheetField;
  return { value: null };
}

/** Return a copy of `sheet` with `key` patched. Field-level merge. */
export function setField(
  sheet: Sheet,
  key: string,
  patch: Partial<SheetField>,
): Sheet {
  const existing = getField(sheet, key);
  return { ...sheet, [key]: { ...existing, ...patch } };
}

/** Apply many field patches at once. */
export function setFields(
  sheet: Sheet,
  patches: Record<string, Partial<SheetField>>,
): Sheet {
  let out = sheet;
  for (const [k, patch] of Object.entries(patches)) {
    out = setField(out, k, patch);
  }
  return out;
}

/**
 * Build a sheet patch from a flat `{key: value}` object, wrapping every value
 * as a locked field. Skips entries with `null`/`undefined`/empty-string. Used
 * by the Fireplace wizard and the LevelUp wizard to hand the LLM concrete
 * player picks.
 */
export function lockedSheetFrom(picks: Record<string, unknown>): Sheet {
  const out: Sheet = {};
  for (const [k, v] of Object.entries(picks)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = { value: v, locked: true };
  }
  return out;
}

/** Read a field's value with a type cast. */
export function fieldValue<T = unknown>(
  sheet: Sheet | null | undefined,
  key: string,
): T | undefined {
  return getField(sheet, key).value as T | undefined;
}
