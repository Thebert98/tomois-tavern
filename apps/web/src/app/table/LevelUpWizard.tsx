"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Dices, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Modal,
  useToast,
} from "@tomois/ui";
import { reroll, type RerollCharacter } from "@/lib/api";
import { playSfx } from "@/lib/sfx";
import { fieldValue, type Sheet } from "@/lib/sheet";
import {
  ABILITIES,
  ASI_LEVELS,
  CLASS_INFO,
  maxSpellLevel,
  spellsKnownAt,
  type Ability,
} from "@/lib/srd";
import { Wizard, type WizardStep } from "@/components/wizard/Wizard";
import { RollingDialog, type RollingHero } from "@/components/RollingDialog";
import { playStylePromptPrefix } from "@/lib/playstyle";
import { TargetStep } from "./levelup-steps/TargetStep";
import { HitDiceStep } from "./levelup-steps/HitDiceStep";
import { ASIStep } from "./levelup-steps/ASIStep";
import { SpellsStep as LevelUpSpellsStep } from "./levelup-steps/SpellsStep";
import { PlayStyleStep } from "./levelup-steps/PlayStyleStep";
import { ReviewStep } from "./levelup-steps/ReviewStep";
import {
  applyAsiToStats,
  crossedAsiLevels,
  type LevelUpState,
} from "./levelup-steps/types";

export interface LevelUpWizardProps {
  character: RerollCharacter | null;
  onClose: () => void;
  onChanged: () => void;
}

const ZERO_STATS: Record<Ability, number> = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

function readStatsFromSheet(sheet: Sheet | undefined): Record<Ability, number> {
  const raw = fieldValue<Record<string, number> | undefined>(sheet, "stats");
  if (!raw || typeof raw !== "object") return { ...ZERO_STATS };
  const out: Record<Ability, number> = { ...ZERO_STATS };
  for (const ab of ABILITIES) {
    const v = raw[ab];
    if (typeof v === "number" && Number.isFinite(v)) out[ab] = v;
  }
  return out;
}

function readSpellsFromSheet(sheet: Sheet | undefined): string[] {
  const raw = fieldValue<unknown>(sheet, "spells");
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

const IDENTITY_FIELDS = [
  "name",
  "race",
  "char_class",
  "background",
  "alignment",
  "level",
];

/**
 * Patch the sheet for a level-up `/generate`:
 *   - identity locked (race / class / background / alignment / name)
 *   - level overwritten to target and locked
 *   - stats overwritten to post-ASI totals and locked
 *   - spells overwritten to current + picked and locked
 *   - everything else (proficiencies, equipment, personality, backstory) freed
 */
function patchedSheet(
  sheet: Sheet,
  target: number,
  finalStats: Record<Ability, number>,
  spells: string[],
  locks: Record<string, boolean>,
): Sheet {
  const next: Sheet = { ...sheet };
  const allKeys = new Set([
    ...Object.keys(sheet),
    ...IDENTITY_FIELDS,
    "stats",
    "spells",
    "proficiencies",
    "equipment",
    "personality",
    "backstory",
  ]);
  for (const key of allKeys) {
    const cell = (next[key] as Record<string, unknown> | undefined) ?? {
      value: null,
    };
    if (IDENTITY_FIELDS.includes(key)) {
      next[key] = {
        ...cell,
        locked: true,
        ...(key === "level" ? { value: target } : {}),
      };
    } else if (key === "stats") {
      next[key] = { ...cell, value: finalStats, locked: locks.stats ?? true };
    } else if (key === "spells") {
      next[key] = { ...cell, value: spells, locked: locks.spells ?? true };
    } else {
      next[key] = { ...cell, locked: false };
    }
  }
  return next;
}

export function LevelUpWizard({
  character,
  onClose,
  onChanged,
}: LevelUpWizardProps) {
  const { toast } = useToast();
  const open = !!character;

  const sheet = character?.sheet as Sheet | undefined;
  const currentLevel = useMemo<number>(() => {
    const raw = fieldValue<number | string>(sheet, "level");
    const n = typeof raw === "number" ? raw : raw ? Number(raw) : 1;
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 19) : 1;
  }, [sheet]);

  const charClass = useMemo<string | null>(() => {
    const raw = fieldValue<string>(sheet, "char_class");
    return typeof raw === "string" && raw ? raw : null;
  }, [sheet]);

  const initial = useMemo<LevelUpState>(
    () => ({
      fromLevel: currentLevel,
      target: Math.min(20, currentLevel + 1),
      charClass: charClass ?? "",
      baseStats: readStatsFromSheet(sheet),
      currentSpells: readSpellsFromSheet(sheet),
      asi: {},
      hp: {},
      spellsAdded: [],
      notes: "",
      playStyle: "balanced",
      locks: {},
    }),
    [currentLevel, charClass, sheet],
  );

  const [errors, setErrors] = useState<
    Array<{ rule: string; field: string; detail: string }>
  >([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const [stage, setStage] = useState<"idle" | "rolling" | "done">("idle");
  const [risenHero, setRisenHero] = useState<RollingHero | null>(null);
  const [whisper, setWhisper] = useState<string>("");

  // Reset wizard state whenever a new character flows in.
  useEffect(() => {
    if (!character) return;
    setErrors([]);
    setSubmitError(null);
    setStage("idle");
    setRisenHero(null);
    setWhisper("");
    setWizardKey((k) => k + 1);
  }, [character]);

  function summarizeHero(
    sheet: Record<string, unknown>,
    fallbackName: string,
  ): RollingHero {
    const name = fieldValue<unknown>(sheet, "name");
    const race = fieldValue<unknown>(sheet, "race");
    const cc = fieldValue<unknown>(sheet, "char_class");
    const level = fieldValue<unknown>(sheet, "level");
    return {
      name:
        typeof name === "string" && name.trim() ? name.trim() : fallbackName,
      race: typeof race === "string" && race ? race : undefined,
      charClass: typeof cc === "string" && cc ? cc : undefined,
      level:
        typeof level === "number" && Number.isFinite(level)
          ? level
          : typeof level === "string" && level
            ? Number(level)
            : undefined,
    };
  }

  function showHpStep(state: LevelUpState): boolean {
    return state.target > state.fromLevel;
  }
  function showAsiStep(state: LevelUpState): boolean {
    return crossedAsiLevels(state.fromLevel, state.target, ASI_LEVELS).length > 0;
  }
  function showSpellsStep(state: LevelUpState): boolean {
    const info = CLASS_INFO[state.charClass];
    if (!info || info.caster === "none") return false;
    const slotGrew =
      maxSpellLevel(state.charClass, state.target) >
      maxSpellLevel(state.charClass, state.fromLevel);
    const capNow = spellsKnownAt(state.charClass, state.fromLevel);
    const capTarget = spellsKnownAt(state.charClass, state.target);
    const cantripsGrew = capTarget.cantrips > capNow.cantrips;
    const spellsGrew = capTarget.spells > capNow.spells;
    return slotGrew || cantripsGrew || spellsGrew;
  }

  // HP / ASI steps are optional — the fire fills in any picks the player
  // skips. Used in submit-time logic, not as a Next-button gate.
  function asiHasPartialPick(state: LevelUpState): boolean {
    const windows = crossedAsiLevels(state.fromLevel, state.target, ASI_LEVELS);
    for (const lvl of windows) {
      const pick = state.asi[lvl];
      if (!pick) continue;
      if (pick.mode === "single" && !pick.singleAbility) return true;
      if (pick.mode === "split" && (!pick.splitA || !pick.splitB)) return true;
      if (pick.mode === "feat" && !(pick.featName?.trim())) return true;
    }
    return false;
  }

  const steps: WizardStep<LevelUpState>[] = [
    {
      id: "target",
      title: "How far do you climb?",
      flavor: "Pick a target level — most heroes step one rung at a time.",
      render: (state, set) => <TargetStep state={state} set={set} />,
    },
    {
      id: "playstyle",
      title: "How do they fight now?",
      flavor: "Stance shapes the ASI highlight and seeds the fire's prompt.",
      optional: true,
      render: (state, set) => <PlayStyleStep state={state} set={set} />,
    },
    {
      id: "hp",
      title: "How hardy is each step?",
      flavor: "Skip to let the fire roll HP; or pick max / average / roll per level.",
      optional: true,
      shouldShow: showHpStep,
      render: (state, set) => <HitDiceStep state={state} set={set} />,
    },
    {
      id: "asi",
      title: "Where do you sharpen?",
      flavor: "Skip to let the fire pick — or bump abilities / take a feat at each ASI window.",
      // Only block Next if the player started a pick but left it incomplete
      // (e.g. picked "split" but didn't choose the second ability).
      isValid: (s) => !asiHasPartialPick(s),
      optional: true,
      shouldShow: showAsiStep,
      render: (state, set) => <ASIStep state={state} set={set} />,
    },
    {
      id: "spells",
      title: "What new words do you learn?",
      flavor: "Add spells unlocked by the climb. The fire fills the rest.",
      shouldShow: showSpellsStep,
      optional: true,
      render: (state, set) => <LevelUpSpellsStep state={state} set={set} />,
    },
    {
      id: "review",
      title: "Ready to roll?",
      flavor: "One last whisper to the fire, then the climb is sealed.",
      optional: true,
      render: (state, set) => <ReviewStep state={state} set={set} />,
    },
  ];

  async function complete(state: LevelUpState) {
    if (!character) return;
    setErrors([]);
    setSubmitError(null);
    setWhisper(state.notes.trim());
    setStage("rolling");
    try {
      const finalStats = applyAsiToStats(state.baseStats, state.asi);
      const mergedSpells = Array.from(
        new Set([...state.currentSpells, ...state.spellsAdded]),
      );
      const hasAsiPicks = Object.keys(state.asi).length > 0;
      const hasSpellPicks = state.spellsAdded.length > 0;
      // Only lock the stats / spells fields if the player actually made
      // picks — otherwise leave them free so the LLM applies the climb.
      const effectiveLocks: Record<string, boolean> = {
        ...state.locks,
        stats: hasAsiPicks ? (state.locks.stats ?? true) : false,
        spells: hasSpellPicks ? (state.locks.spells ?? true) : false,
      };
      const patched = patchedSheet(
        character.sheet as Sheet,
        state.target,
        finalStats,
        mergedSpells,
        effectiveLocks,
      );
      await reroll.update(character.id, { sheet: patched });

      const hpGain = Object.values(state.hp).reduce((a, h) => a + h.value, 0);
      const featNames = Object.values(state.asi)
        .filter((p) => p.mode === "feat" && p.featName?.trim())
        .map((p) => p.featName!.trim());
      const noteParts: string[] = [
        `Climbing from level ${state.fromLevel} to ${state.target}.`,
      ];
      if (hpGain > 0) noteParts.push(`Total HP gain across the climb: +${hpGain}.`);
      if (featNames.length > 0) {
        noteParts.push(`Feat${featNames.length > 1 ? "s" : ""} taken: ${featNames.join(", ")}.`);
      }
      if (state.notes.trim()) noteParts.push(state.notes.trim());
      const prefix = playStylePromptPrefix(state.playStyle);
      const note = (prefix + noteParts.join(" ")).trim();

      const result = await reroll.generate(character.id, note);
      setErrors(result.validation_errors ?? []);
      void playSfx("embers");
      onChanged();
      if (result.validation_errors?.length) {
        toast("Re-rolled — but the rules object to a detail.", { tone: "error" });
        setStage("idle");
      } else {
        setRisenHero(
          summarizeHero(
            result.character.sheet as Record<string, unknown>,
            result.character.name || "Your hero",
          ),
        );
        setStage("done");
      }
    } catch (e) {
      handleClimbError(e);
    }
  }

  function handleClimbError(e: unknown) {
    const msg = e instanceof Error ? e.message : "The fire wouldn't catch.";
    if (msg.includes("429")) {
      setSubmitError(
        "The fire is spent for the day (20 rerolls/day). Try again tomorrow.",
      );
    } else {
      setSubmitError(msg.replace(/^\d+:\s*/, ""));
    }
    setStage("idle");
  }

  async function randomizeLevelUp() {
    if (!character) return;
    setErrors([]);
    setSubmitError(null);
    setWhisper("");
    setStage("rolling");
    try {
      const patched = patchedSheet(
        character.sheet as Sheet,
        initial.target,
        initial.baseStats,
        initial.currentSpells,
        { stats: false, spells: false },
      );
      await reroll.update(character.id, { sheet: patched });
      const note = `Climbing from level ${initial.fromLevel} to ${initial.target}. Let the fire decide what changes.`;
      const result = await reroll.generate(character.id, note);
      setErrors(result.validation_errors ?? []);
      void playSfx("embers");
      onChanged();
      if (result.validation_errors?.length) {
        toast("Re-rolled — but the rules object to a detail.", { tone: "error" });
        setStage("idle");
      } else {
        setRisenHero(
          summarizeHero(
            result.character.sheet as Record<string, unknown>,
            result.character.name || "Your hero",
          ),
        );
        setStage("done");
      }
    } catch (e) {
      handleClimbError(e);
    }
  }

  function dismissDialog() {
    setStage("idle");
    setRisenHero(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        character
          ? `Level ${currentLevel} → ${initial.target}`
          : "Level up"
      }
      description={
        character
          ? `${character.name || "this hero"} steps closer to legend. Identity is preserved; mechanics advance.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={stage !== "idle"}>
            close
          </Button>
          <Button
            variant="secondary"
            onClick={randomizeLevelUp}
            disabled={stage !== "idle"}
          >
            <Dices className="h-4 w-4" />
            {stage === "rolling" ? "rolling…" : "let the fire roll it"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Wizard
          key={wizardKey}
          steps={steps}
          initialState={initial}
          completeLabel={
            stage === "rolling" ? "rolling…" : "roll the next chapter"
          }
          onComplete={complete}
        />

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

        {submitError && (
          <Card compact className="border-tavern-blood/50 bg-tavern-blood/10">
            <p className="flex items-start gap-2 text-sm text-tavern-blood">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </p>
          </Card>
        )}
      </div>

      <RollingDialog
        open={stage === "rolling" || stage === "done"}
        stage={stage === "done" ? "done" : "rolling"}
        hero={risenHero}
        whisper={whisper}
        doneCaption={
          risenHero?.level
            ? `rises to level ${risenHero.level}.`
            : "rises with the climb."
        }
        dismissLabel="back to the table"
        onDismiss={dismissDialog}
      />
    </Modal>
  );
}
