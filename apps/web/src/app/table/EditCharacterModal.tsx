"use client";

import { useEffect, useState } from "react";
import { Save, Sparkles, AlertTriangle } from "lucide-react";
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
import { ensureFreshSession, reroll, type RerollCharacter } from "@/lib/api";
import { playSfx } from "@/lib/sfx";
import { getField, setField, type SheetField } from "@/lib/sheet";
import { FieldLock } from "@/components/wizard/FieldLock";

/**
 * Edit modal — full sheet editor with per-field lock toggles and a
 * "reroll the unlocked" button. Mechanically identical to the previous
 * Fireplace UX (kept that way intentionally so muscle memory carries
 * over). Lives at the Round Table now; the Fireplace becomes the new-hero
 * forge in PR 6.
 */

type FieldKind = "text" | "number" | "long";
type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
};

const FIELDS: FieldDef[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "race", label: "Race", kind: "text", placeholder: "Half-Elf" },
  { key: "char_class", label: "Class", kind: "text", placeholder: "Cleric" },
  { key: "background", label: "Background", kind: "text", placeholder: "Acolyte" },
  { key: "alignment", label: "Alignment", kind: "text", placeholder: "Lawful Good" },
  { key: "level", label: "Level", kind: "number" },
  { key: "personality", label: "Personality", kind: "long" },
  { key: "backstory", label: "Backstory", kind: "long" },
];

export interface EditCharacterModalProps {
  character: RerollCharacter | null;
  onClose: () => void;
  /** Called after a successful save or reroll so the roster refreshes. */
  onChanged: () => void;
}

export function EditCharacterModal({
  character,
  onClose,
  onChanged,
}: EditCharacterModalProps) {
  const { toast } = useToast();
  const open = !!character;

  const [sheet, setSheet] = useState<Record<string, unknown> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<
    Array<{ rule: string; field: string; detail: string }>
  >([]);

  // Reset when the modal opens for a new character.
  useEffect(() => {
    if (!character) return;
    setSheet(character.sheet as Record<string, unknown>);
    setDirty(false);
    setErrors([]);
    setNotes("");
  }, [character]);

  function patchField(key: string, patch: Partial<SheetField>) {
    if (!sheet) return;
    setSheet(setField(sheet, key, patch));
    setDirty(true);
  }

  // The sheet stores the name as a field; ReRoll also has a name column.
  // Keep them in lockstep — when saving, also update the name column if the
  // sheet's name.value changed.
  function sheetName(): string | null {
    const v = getField(sheet, "name").value;
    return typeof v === "string" && v.trim() ? v.trim() : null;
  }

  async function save() {
    if (!character || !sheet || !dirty) return;
    setSaving(true);
    try {
      const nm = sheetName();
      const updated = await reroll.update(character.id, {
        sheet,
        ...(nm && nm !== character.name ? { name: nm } : {}),
      });
      setSheet(updated.sheet as Record<string, unknown>);
      setDirty(false);
      toast("Sheet saved by the firelight.", { tone: "success" });
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save the sheet.", {
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function reroll_() {
    if (!character) return;
    setGenerating(true);
    setErrors([]);
    try {
      // The reroll path may do update→generate back-to-back; refresh the
      // JWT first so an expiry between calls can't strand the sheet.
      await ensureFreshSession();
      if (dirty && sheet) {
        const nm = sheetName();
        await reroll.update(character.id, {
          sheet,
          ...(nm && nm !== character.name ? { name: nm } : {}),
        });
        setDirty(false);
      }
      const result = await reroll.generate(character.id, notes.trim());
      setSheet(result.character.sheet as Record<string, unknown>);
      setErrors(result.validation_errors ?? []);
      void playSfx("embers");
      if (result.validation_errors?.length) {
        toast("Re-rolled — but the rules object to a detail.", {
          tone: "error",
        });
      } else {
        toast("The fire spits sparks — your hero shifts.", {
          tone: "success",
        });
      }
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Mirror Fireplace + LevelUp's friendly copy when the per-user
      // 20/day rate-limit fires (ReRoll surfaces it as a 429).
      if (msg.includes("429")) {
        toast(
          "The fire is spent for the day (20 rerolls/day). Try again tomorrow.",
          { tone: "error" },
        );
      } else {
        toast(msg || "The fire wouldn't catch.", { tone: "error" });
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${character?.name ?? "hero"}`}
      description="Lock what you love, free the rest, reroll. Saves and rerolls both share the 20/day generation limit."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            done
          </Button>
          <Button
            variant="secondary"
            onClick={save}
            disabled={!dirty || saving}
          >
            <Save className="h-4 w-4" />
            {saving ? "saving…" : "save"}
          </Button>
          <Button onClick={reroll_} disabled={generating}>
            <Sparkles className="h-4 w-4" />
            {generating ? "rolling…" : "reroll the unlocked"}
          </Button>
        </>
      }
    >
      <div className="max-h-[60svh] overflow-y-auto pr-1 scroll-tavern">
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              state={getField(sheet, f.key)}
              onChange={(v) => patchField(f.key, { value: v })}
              onToggleLock={() =>
                patchField(f.key, { locked: !getField(sheet, f.key).locked })
              }
            />
          ))}
        </div>

        <div className="mt-5">
          <Label htmlFor="edit-notes">Whisper to the fire (optional)</Label>
          <Textarea
            id="edit-notes"
            rows={2}
            placeholder="e.g. a tragic backstory tied to the burned harbor"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {errors.length > 0 && (
          <Card
            compact
            className="mt-4 border-tavern-blood/50 bg-tavern-blood/10"
          >
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

function FieldRow({
  field,
  state,
  onChange,
  onToggleLock,
}: {
  field: FieldDef;
  state: SheetField;
  onChange: (v: unknown) => void;
  onToggleLock: () => void;
}) {
  const id = `edit-${field.key}`;
  const v = state.value;
  return (
    <div className="grid items-start gap-2 sm:grid-cols-[120px_1fr_auto]">
      <Label htmlFor={id} className="mb-0 mt-2">
        {field.label}
      </Label>
      {field.kind === "long" ? (
        <Textarea
          id={id}
          rows={3}
          placeholder={field.placeholder}
          value={typeof v === "string" ? v : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.kind === "number" ? (
        <Input
          id={id}
          type="number"
          min={1}
          max={20}
          value={typeof v === "number" ? v : v ? Number(v) : ""}
          placeholder="1"
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange(n);
          }}
        />
      ) : (
        <Input
          id={id}
          type="text"
          placeholder={field.placeholder}
          value={typeof v === "string" ? v : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <FieldLock
        locked={!!state.locked}
        onToggle={onToggleLock}
        label={field.label}
      />
    </div>
  );
}
