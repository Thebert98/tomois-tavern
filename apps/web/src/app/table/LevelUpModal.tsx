"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronUp, Sparkles, AlertTriangle, Quote } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  Textarea,
  useToast,
} from "@tomois/ui";
import { reroll, type RerollCharacter } from "@/lib/api";
import { playSfx } from "@/lib/sfx";
import { levelUpHighlights } from "@/lib/srd";

/** Helper: read .value from a {value,locked,source} cell. */
function fieldValue<T = unknown>(
  sheet: Record<string, unknown> | undefined,
  key: string,
): T | undefined {
  const cell = sheet?.[key] as { value?: unknown } | undefined;
  return cell?.value as T | undefined;
}

/** Identity fields are locked during a level-up; everything else is freed. */
const IDENTITY_FIELDS = [
  "name",
  "race",
  "char_class",
  "background",
  "alignment",
  "level",
];
const ALL_FIELDS = [
  ...IDENTITY_FIELDS,
  "stats",
  "proficiencies",
  "spells",
  "equipment",
  "personality",
  "backstory",
];

function lockFieldsForLevelUp(
  sheet: Record<string, unknown>,
  targetLevel: number,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...sheet };
  for (const key of ALL_FIELDS) {
    const cell = (next[key] as Record<string, unknown>) ?? { value: null };
    const locked = IDENTITY_FIELDS.includes(key);
    next[key] = {
      ...cell,
      locked,
      // overwrite level with the target value
      ...(key === "level" ? { value: targetLevel } : {}),
    };
  }
  return next;
}

export interface LevelUpModalProps {
  character: RerollCharacter | null;
  onClose: () => void;
  /** Called after a successful level-up so the roster refreshes. */
  onChanged: () => void;
}

export function LevelUpModal({
  character,
  onClose,
  onChanged,
}: LevelUpModalProps) {
  const { toast } = useToast();
  const open = !!character;

  const currentLevel = useMemo<number>(() => {
    const raw = fieldValue<number | string>(
      character?.sheet as Record<string, unknown> | undefined,
      "level",
    );
    const n = typeof raw === "number" ? raw : raw ? Number(raw) : 1;
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 19) : 1;
  }, [character]);

  const charClass = useMemo<string | null>(() => {
    const raw = fieldValue<string>(
      character?.sheet as Record<string, unknown> | undefined,
      "char_class",
    );
    return typeof raw === "string" && raw ? raw : null;
  }, [character]);

  const [target, setTarget] = useState<number>(currentLevel + 1);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState<
    Array<{ rule: string; field: string; detail: string }>
  >([]);
  const [doneSheet, setDoneSheet] = useState<Record<string, unknown> | null>(
    null,
  );

  // Reset when a new character flows in.
  useEffect(() => {
    if (!character) return;
    setTarget(Math.min(20, currentLevel + 1));
    setNotes("");
    setErrors([]);
    setDoneSheet(null);
  }, [character, currentLevel]);

  const highlights = useMemo(
    () => levelUpHighlights(charClass, currentLevel, target),
    [charClass, currentLevel, target],
  );

  async function roll() {
    if (!character) return;
    if (target <= currentLevel) {
      toast("Pick a higher target level to climb to.", { tone: "error" });
      return;
    }
    setGenerating(true);
    setErrors([]);
    setDoneSheet(null);
    try {
      const patched = lockFieldsForLevelUp(
        character.sheet as Record<string, unknown>,
        target,
      );
      await reroll.update(character.id, { sheet: patched });
      const note =
        notes.trim() ||
        `Leveling from ${currentLevel} to ${target}. Keep identity; advance mechanics.`;
      const result = await reroll.generate(character.id, note);
      setDoneSheet(result.character.sheet as Record<string, unknown>);
      setErrors(result.validation_errors ?? []);
      void playSfx("embers");
      if (result.validation_errors?.length) {
        toast("Re-rolled — but the rules object to a detail.", {
          tone: "error",
        });
      } else {
        toast(`Your hero rises to level ${target}.`, { tone: "success" });
      }
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The fire wouldn't catch.";
      // Rate-limit (20/day) returns a 429 from ReRoll's SlowAPI middleware.
      if (msg.includes("429")) {
        toast(
          "The fire is spent for the day (20 rerolls/day). Try again tomorrow.",
          { tone: "error" },
        );
      } else {
        toast(msg, { tone: "error" });
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Level ${currentLevel} → ${target}`}
      description={
        character
          ? `${character.name || "this hero"} steps closer to legend. Identity is preserved; mechanics advance.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            close
          </Button>
          <Button onClick={roll} disabled={generating}>
            <ChevronUp className="h-4 w-4" />
            {generating ? "rolling…" : "roll the next chapter"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Target level picker */}
        <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor="level-target">Target level</Label>
            <Input
              id="level-target"
              type="number"
              min={Math.max(2, currentLevel + 1)}
              max={20}
              value={target}
              onChange={(e) => {
                const n = Number(e.target.value);
                setTarget(
                  Number.isFinite(n)
                    ? Math.min(20, Math.max(currentLevel + 1, n))
                    : currentLevel + 1,
                );
              }}
            />
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="font-heading text-[0.6rem] uppercase tracking-[0.25em] text-tavern-parchment/55">
              currently
            </span>
            <span className="font-heading text-xl uppercase tracking-[0.2em] text-tavern-gold">
              lvl {currentLevel}
            </span>
          </div>
        </div>

        {/* What's new — derived from lib/srd.ts */}
        {highlights.length > 0 && (
          <Card compact>
            <h4 className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-gold">
              What changes
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-tavern-parchment/85">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-tavern-gold/80" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            {!charClass && (
              <p className="mt-2 text-xs italic text-tavern-stone">
                (Class is unset — the hints will sharpen once a class is
                rolled.)
              </p>
            )}
          </Card>
        )}

        {/* User notes */}
        <div>
          <Label htmlFor="levelup-notes">
            <Quote className="mr-1 inline h-3 w-3" />
            What did your hero learn?
          </Label>
          <Textarea
            id="levelup-notes"
            rows={2}
            placeholder="e.g. they survived a near-miss at the harbor and grew warier."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Diff after the roll */}
        {doneSheet && (
          <Card compact className="border-tavern-gold/40 bg-tavern-night/70">
            <h4 className="font-heading text-xs uppercase tracking-[0.25em] text-tavern-gold">
              Risen to level {target}
            </h4>
            <ul className="mt-2 space-y-1 text-xs text-tavern-parchment/80">
              {(() => {
                const after = doneSheet;
                const before = character?.sheet as
                  | Record<string, unknown>
                  | undefined;
                const lines: string[] = [];
                const newSpells = arrayValue(after, "spells");
                const oldSpells = arrayValue(before, "spells");
                const added = newSpells.filter((s) => !oldSpells.includes(s));
                if (added.length) {
                  lines.push(`New spells: ${added.slice(0, 6).join(", ")}.`);
                }
                const newProf = arrayValue(after, "proficiencies");
                const oldProf = arrayValue(before, "proficiencies");
                const profAdded = newProf.filter((s) => !oldProf.includes(s));
                if (profAdded.length) {
                  lines.push(
                    `New proficiencies: ${profAdded.slice(0, 4).join(", ")}.`,
                  );
                }
                if (lines.length === 0) {
                  lines.push("Sheet refreshed — open it for the full reading.");
                }
                return lines.map((l, i) => <li key={i}>{l}</li>);
              })()}
            </ul>
          </Card>
        )}

        {/* Validation issues */}
        {errors.length > 0 && (
          <Card compact className="border-tavern-blood/50 bg-tavern-blood/10">
            <div className="flex items-start gap-2 text-sm text-tavern-blood">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-heading text-xs uppercase tracking-[0.25em]">
                  The rules object
                </div>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-tavern-parchment/85">
                  {errors.map((e, i) => (
                    <li key={i}>
                      <Chip tone="warning" className="mr-2">
                        {e.field}
                      </Chip>
                      {e.detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
}

function arrayValue(
  sheet: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const cell = sheet?.[key] as { value?: unknown } | undefined;
  const v = cell?.value;
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  return [];
}
