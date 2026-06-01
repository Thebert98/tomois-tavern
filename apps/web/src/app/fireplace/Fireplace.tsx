"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, Unlock, Flame, Save, Sparkles, AlertTriangle } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
  useToast,
} from "@tomois/ui";
import { reroll, type RerollCharacter } from "@/lib/api";
import { playSfx } from "@/lib/sfx";

/**
 * The Fireplace — character forge. Reads ReRoll's sheet shape and offers
 * the locked-field iteration UX directly in the tavern shell.
 *
 * Each ReRoll sheet field is `{ value, locked, source }`. We expose the
 * key ones (name, race, class, background, alignment, level, personality,
 * backstory) as editable inputs with a lock toggle, and ship "regenerate
 * the unlocked fields" against POST /characters/{id}/generate.
 */
type Field = {
  key: string;
  label: string;
  kind: "text" | "number" | "long";
  placeholder?: string;
};

const FIELDS: Field[] = [
  { key: "name", label: "Name", kind: "text" },
  { key: "race", label: "Race", kind: "text", placeholder: "Half-Elf" },
  { key: "char_class", label: "Class", kind: "text", placeholder: "Cleric" },
  { key: "background", label: "Background", kind: "text", placeholder: "Acolyte" },
  { key: "alignment", label: "Alignment", kind: "text", placeholder: "Lawful Good" },
  { key: "level", label: "Level", kind: "number" },
  { key: "personality", label: "Personality", kind: "long" },
  { key: "backstory", label: "Backstory", kind: "long" },
];

type SheetField = { value: unknown; locked?: boolean; source?: string };

function getField(
  sheet: Record<string, unknown> | null,
  key: string,
): SheetField {
  const raw = sheet?.[key];
  if (raw && typeof raw === "object") return raw as SheetField;
  return { value: null };
}

function setField(
  sheet: Record<string, unknown>,
  key: string,
  patch: Partial<SheetField>,
): Record<string, unknown> {
  const existing = getField(sheet, key);
  return { ...sheet, [key]: { ...existing, ...patch } };
}

export function Fireplace() {
  const { toast } = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const characterParam = params.get("character");

  const [characters, setCharacters] = useState<RerollCharacter[] | null>(null);
  const [active, setActive] = useState<RerollCharacter | null>(null);
  const [sheet, setSheet] = useState<Record<string, unknown> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<
    Array<{ rule: string; field: string; detail: string }>
  >([]);

  // Load roster on mount.
  useEffect(() => {
    void reroll
      .listCharacters()
      .then((cs) => setCharacters(cs))
      .catch(() => setCharacters([]));
  }, []);

  // If ?character=ID is in the URL, focus that.
  useEffect(() => {
    if (!characters || !characterParam) return;
    const found = characters.find((c) => c.id === characterParam);
    if (found && active?.id !== found.id) {
      setActive(found);
      setSheet(found.sheet as Record<string, unknown>);
      setDirty(false);
      setErrors([]);
    }
  }, [characters, characterParam, active?.id]);

  function pick(c: RerollCharacter) {
    setActive(c);
    setSheet(c.sheet as Record<string, unknown>);
    setDirty(false);
    setErrors([]);
    router.replace(`/fireplace?character=${c.id}`);
  }

  async function save() {
    if (!active || !sheet || !dirty) return;
    setSaving(true);
    try {
      const updated = await reroll.updateSheet(active.id, sheet);
      setActive(updated);
      setSheet(updated.sheet as Record<string, unknown>);
      setDirty(false);
      toast("Sheet saved by the firelight.", { tone: "success" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save the sheet.", {
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!active) return;
    setGenerating(true);
    setErrors([]);
    try {
      // Save any pending edits first so the regeneration sees fresh locks.
      if (dirty && sheet) {
        await reroll.updateSheet(active.id, sheet);
        setDirty(false);
      }
      const result = await reroll.generate(active.id, notes.trim());
      setActive(result.character);
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
    } catch (e) {
      toast(e instanceof Error ? e.message : "The fire wouldn't catch.", {
        tone: "error",
      });
    } finally {
      setGenerating(false);
    }
  }

  function patchField(key: string, patch: Partial<SheetField>) {
    if (!sheet) return;
    setSheet(setField(sheet, key, patch));
    setDirty(true);
  }

  const lockedCount = useMemo(() => {
    if (!sheet) return 0;
    return FIELDS.filter((f) => getField(sheet, f.key).locked).length;
  }, [sheet]);

  // ---------- Render ----------
  if (characters === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }
  if (characters.length === 0) {
    return (
      <EmptyState
        icon={<Flame className="h-7 w-7" />}
        title="No heroes seated"
        description="Visit the Round Table to seat a hero, then bring them to the fire."
        action={
          <Button onClick={() => router.push("/table")}>open the table</Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* Roster sidebar */}
      <aside>
        <Label>Heroes at the hearth</Label>
        <ul className="space-y-1">
          {characters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pick(c)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold ${
                  active?.id === c.id
                    ? "border-tavern-gold/70 bg-tavern-night/80 text-tavern-parchment"
                    : "border-tavern-stone/30 bg-tavern-night/50 text-tavern-parchment/75 hover:border-tavern-gold/50"
                }`}
              >
                <div className="truncate font-heading text-xs uppercase tracking-[0.2em]">
                  {c.name || "Untitled"}
                </div>
                <div className="mt-0.5 truncate text-[0.6rem] italic text-tavern-parchment/55">
                  last touched{" "}
                  {c.updated_at
                    ? new Date(c.updated_at).toLocaleDateString()
                    : "—"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Sheet editor */}
      <section className="space-y-5">
        {!active ? (
          <EmptyState
            icon={<Flame className="h-7 w-7" />}
            title="Pick a hero"
            description="Choose one from the list to bring them to the fire."
          />
        ) : (
          <>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading text-lg uppercase tracking-[0.25em] text-tavern-parchment">
                    {(getField(sheet, "name").value as string) || active.name || "Untitled"}
                  </h3>
                  <p className="mt-1 text-xs italic text-tavern-parchment/55">
                    {lockedCount} field{lockedCount === 1 ? "" : "s"} locked
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={save}
                    disabled={!dirty || saving}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "saving…" : "save"}
                  </Button>
                  <Button onClick={regenerate} disabled={generating}>
                    <Sparkles className="h-4 w-4" />
                    {generating ? "rolling…" : "reroll"}
                  </Button>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {FIELDS.map((f) => (
                  <FieldRow
                    key={f.key}
                    field={f}
                    state={getField(sheet, f.key)}
                    onChange={(v) => patchField(f.key, { value: v })}
                    onToggleLock={() =>
                      patchField(f.key, {
                        locked: !getField(sheet, f.key).locked,
                      })
                    }
                  />
                ))}
              </div>

              <div className="mt-6">
                <Label htmlFor="user-notes">
                  Whisper to the fire (optional)
                </Label>
                <Textarea
                  id="user-notes"
                  rows={2}
                  placeholder="e.g. a tragic backstory tied to the burned harbor"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </Card>

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
          </>
        )}
      </section>
    </div>
  );
}

function FieldRow({
  field,
  state,
  onChange,
  onToggleLock,
}: {
  field: Field;
  state: SheetField;
  onChange: (v: unknown) => void;
  onToggleLock: () => void;
}) {
  const id = `f-${field.key}`;
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
      <button
        type="button"
        onClick={onToggleLock}
        aria-pressed={!!state.locked}
        aria-label={
          state.locked ? `Unlock ${field.label}` : `Lock ${field.label}`
        }
        className={`inline-flex h-9 items-center gap-1 rounded-md border px-2 text-xs uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold ${
          state.locked
            ? "border-tavern-gold/80 bg-tavern-gold/15 text-tavern-gold"
            : "border-tavern-stone/35 text-tavern-parchment/55 hover:border-tavern-gold/50"
        }`}
      >
        {state.locked ? (
          <>
            <Lock className="h-3 w-3" />
            locked
          </>
        ) : (
          <>
            <Unlock className="h-3 w-3" />
            free
          </>
        )}
      </button>
    </div>
  );
}
