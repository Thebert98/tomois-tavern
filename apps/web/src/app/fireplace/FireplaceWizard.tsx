"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Dices, Flame } from "lucide-react";
import { Button, Card } from "@tomois/ui";
import { Wizard, type WizardStep } from "@/components/wizard/Wizard";
import { RollingDialog, type RollingHero } from "@/components/RollingDialog";
import { ensureFreshSession, reroll } from "@/lib/api";
import { fieldValue, sheetFromPicks } from "@/lib/sheet";
import { playSfx } from "@/lib/sfx";
import {
  ABILITIES,
  applyRaceASI,
  CLASS_INFO,
  type Ability,
} from "@/lib/srd";
import { playStylePromptPrefix, type PlayStyle } from "@/lib/playstyle";
import { frameHeroSeed, pickHeroSeed } from "@/lib/heroSeeds";
import { cascadePicks } from "@/lib/cascade";
import { namingConventionFor } from "@/lib/heritage";
import { srdConstraintsFor } from "@/lib/srdConstraints";
import { IdentityStep } from "./steps/IdentityStep";
import { AlignmentLevelStep } from "./steps/AlignmentLevelStep";
import { PlayStyleStep } from "./steps/PlayStyleStep";
import { StatsStep } from "./steps/StatsStep";
import { SpellsStep } from "./steps/SpellsStep";
import { SealStep } from "./steps/SealStep";

export type StatsMethod = "array" | "pointbuy" | "roll";

/**
 * Wizard state — every step writes into this single object. PR 4 will add
 * `spells`. `vibe` lives at the bottom of the page in this PR; PR 4 promotes
 * it to its own SealStep.
 */
export interface FireplaceState {
  name: string;
  race: string;
  char_class: string;
  background: string;
  alignment: string;
  level: number;
  vibe: string;
  statsMethod: StatsMethod | null;
  /** Unassigned scores remaining for array / roll methods. */
  statsPool: number[];
  /** Base (pre-race-ASI) scores. Pointbuy fills 8s; others start at 0. */
  stats: Record<Ability, number>;
  /** Player-picked spells (cantrips + leveled) for casters. */
  spells: string[];
  /** When true, the SpellsStep yields and the fire chooses spells. */
  autoSpells: boolean;
  /**
   * Per-field lock map. Missing key defaults to `true` (locked). A `false`
   * lets the LLM revise the pick during /generate; the value still seeds
   * the prompt so it's treated as a suggestion rather than from-scratch.
   */
  locks: Record<string, boolean>;
  /** Stance — biases recommendations and seeds the /generate prompt. */
  playStyle: PlayStyle;
}

const INITIAL: FireplaceState = {
  name: "",
  race: "",
  char_class: "",
  background: "",
  alignment: "",
  level: 1,
  vibe: "",
  statsMethod: null,
  statsPool: [],
  stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  spells: [],
  autoSpells: true,
  locks: {},
  playStyle: "balanced",
};

function statsComplete(state: FireplaceState): boolean {
  if (!state.statsMethod) return false;
  const minVal = state.statsMethod === "pointbuy" ? 8 : 1;
  return ABILITIES.every((ab) => (state.stats[ab] ?? 0) >= minVal);
}

function isCaster(charClass: string): boolean {
  return (CLASS_INFO[charClass]?.caster ?? "none") !== "none";
}

/**
 * Short, unique placeholder used as the row name while /generate runs.
 * The sheet's name field is freed at submit time so the LLM generates a
 * proper name; `settleHero` then syncs the row name back. The placeholder
 * is only visible if a third party views the roster during that window.
 */
function workingTitle(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Newcomer #${n}`;
}

export function FireplaceWizard() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "rolling" | "done">("idle");
  const [rolledHero, setRolledHero] = useState<RollingHero | null>(null);
  const [rolledId, setRolledId] = useState<string | null>(null);
  const [whisper, setWhisper] = useState<string>("");

  const steps: WizardStep<FireplaceState>[] = [
    {
      id: "identity",
      title: "Who are you?",
      flavor: "Leave any field empty (and free) to let the fire decide it.",
      optional: true,
      render: (state, set) => <IdentityStep state={state} set={set} />,
    },
    {
      id: "alignment-level",
      title: "Where do you stand?",
      flavor: "Choose an alignment — or leave none and the fire chooses. Pick a level.",
      optional: true,
      render: (state, set) => <AlignmentLevelStep state={state} set={set} />,
    },
    {
      id: "playstyle",
      title: "How do they fight?",
      flavor: "Pick a stance — it shapes recommendations and what the fire weaves in.",
      optional: true,
      render: (state, set) => <PlayStyleStep state={state} set={set} />,
    },
    {
      id: "stats",
      title: "What sharpens your edge?",
      flavor: "Optional — skip to let the fire roll your stats, or pick a method and place the numbers.",
      optional: true,
      render: (state, set) => <StatsStep state={state} set={set} />,
    },
    {
      id: "spells",
      title: "What words do you carry?",
      flavor: "Pick a starting spell palette — or let the fire choose for you.",
      // Only present this step for caster classes.
      shouldShow: (s) => isCaster(s.char_class),
      optional: true,
      render: (state, set) => <SpellsStep state={state} set={set} />,
    },
    {
      id: "seal",
      title: "Light the fire.",
      flavor: "One last whisper, then the hearth paints your hero.",
      optional: true,
      render: (state, set) => <SealStep state={state} set={set} />,
    },
  ];

  function handleError(e: unknown) {
    const msg = e instanceof Error ? e.message : "The fire wouldn't catch.";
    if (msg.includes("429")) {
      setError(
        "The fire is spent for the day (20 rerolls/day). Try again tomorrow.",
      );
    } else {
      setError(msg.replace(/^\d+:\s*/, ""));
    }
    setStage("idle");
  }

  /**
   * Pull a display-ready hero summary out of a generate result and sync the
   * row name back from the freshly-generated sheet so the Round Table
   * shows the right name (otherwise the placeholder row name sticks).
   */
  async function settleHero(
    characterId: string,
    sheet: Record<string, unknown>,
    rowName: string,
    userTypedName: boolean,
  ): Promise<RollingHero> {
    const sheetName = fieldValue<unknown>(sheet, "name");
    const resolvedName =
      typeof sheetName === "string" && sheetName.trim()
        ? sheetName.trim()
        : null;
    // Sync the row name from the sheet whenever the player didn't lock one.
    // (When they did, we keep their pick — the AI may have echoed something
    // identical or different; the lock is the source of truth.)
    let displayName = rowName;
    if (!userTypedName && resolvedName && resolvedName !== rowName) {
      try {
        const renamed = await reroll.renameCharacter(characterId, resolvedName);
        displayName = renamed.name;
      } catch {
        displayName = resolvedName;
      }
    } else if (userTypedName) {
      displayName = rowName;
    } else if (resolvedName) {
      displayName = resolvedName;
    }
    const race = fieldValue<unknown>(sheet, "race");
    const char_class = fieldValue<unknown>(sheet, "char_class");
    const level = fieldValue<unknown>(sheet, "level");
    return {
      name: displayName,
      race: typeof race === "string" && race ? race : undefined,
      charClass: typeof char_class === "string" && char_class ? char_class : undefined,
      level:
        typeof level === "number" && Number.isFinite(level)
          ? level
          : typeof level === "string" && level
            ? Number(level)
            : 1,
    };
  }

  async function complete(state: FireplaceState) {
    const typedName = state.name.trim();
    // Empty name → no row placeholder. We pick a brief working title that
    // will be replaced after generation; never use the same default twice.
    const rowName = typedName || workingTitle();
    setError(null);
    setWhisper(state.vibe.trim());
    setStage("rolling");
    try {
      // Refresh the JWT BEFORE the multi-step create→update→generate
      // sequence so an expiry mid-flight can't strand a half-built
      // character. authedFetch also retries once on a fresh 401, but the
      // proactive refresh saves the round-trip in the common case.
      await ensureFreshSession();
      const created = await reroll.createCharacter(rowName);
      setRolledId(created.id);
      // Cascade-fill any structural slot the player left empty. User picks
      // anchor the cascade; affinity weights coherently pick the rest.
      const anchors = cascadePicks({
        race: state.race,
        charClass: state.char_class,
        background: state.background,
        alignment: state.alignment,
        level: state.level !== 1 ? state.level : null,
      });
      const resolvedStats = statsComplete(state)
        ? applyRaceASI(anchors.race, state.stats)
        : null;
      const spellsPicked =
        isCaster(anchors.charClass) && !state.autoSpells && state.spells.length > 0;
      const picks: Record<string, unknown> = {
        name: typedName || null,
        race: anchors.race,
        char_class: anchors.charClass,
        background: anchors.background,
        alignment: anchors.alignment,
        level: anchors.level !== 1 ? anchors.level : null,
        stats: resolvedStats,
        spells: spellsPicked ? state.spells : null,
      };
      const sheet = sheetFromPicks(picks, state.locks);
      // If the player didn't enter a name, explicitly null + free the sheet's
      // name field so the LLM generates a fresh one. Without this the
      // backend's row-name placeholder leaks into the sheet and the AI keeps
      // it (which is how every randomize ended up named "Unnamed Hero").
      if (!typedName) {
        sheet.name = { value: null, locked: false };
      }
      if (Object.keys(sheet).length > 0) {
        await reroll.update(created.id, { sheet });
      }
      const prefix = playStylePromptPrefix(state.playStyle);
      // Heritage-aware naming hint keyed to the resolved race (user pick or
      // cascade-picked). The LLM is good at producing tradition-accurate
      // names once it knows the convention.
      const naming = namingConventionFor(anchors.race);
      // Hard SRD rails — background's granted skills + the legal spell list
      // for this class+level. Stops the LLM from forgetting Acolyte's
      // Insight+Religion or giving a level-1 Druid Spirit Guardians.
      const constraints = srdConstraintsFor(anchors);
      // When the player didn't write a vibe, inject a random hero seed so
      // the LLM has something specific to riff on (without it, the model
      // collapses to the same handful of default archetypes).
      const userVibe = state.vibe.trim();
      const seed = userVibe ? "" : frameHeroSeed(pickHeroSeed(2));
      const vibePayload = [prefix, naming, constraints, userVibe, seed]
        .filter(Boolean)
        .join(" ")
        .trim();
      const result = await reroll.generate(created.id, vibePayload);
      const hero = await settleHero(
        created.id,
        result.character.sheet as Record<string, unknown>,
        result.character.name,
        Boolean(typedName) && (state.locks.name ?? false),
      );
      setRolledHero(hero);
      void playSfx("embers");
      setStage("done");
    } catch (e) {
      handleError(e);
    }
  }

  async function randomizeAll() {
    if (stage === "rolling") return;
    setError(null);
    setWhisper("");
    setStage("rolling");
    try {
      await ensureFreshSession();
      const rowName = workingTitle();
      const created = await reroll.createCharacter(rowName);
      setRolledId(created.id);
      // Pure-random run — cascade fills every anchor with no user inputs.
      const anchors = cascadePicks({});
      // Seed the sheet with the cascade picks (free), so the LLM honors the
      // chosen race/class/etc as strong suggestions while still being free
      // to revise if something else conflicts. The name field is explicitly
      // null + free so the LLM produces a fresh, heritage-coherent name.
      await reroll.update(created.id, {
        sheet: {
          name: { value: null, locked: false },
          race: { value: anchors.race, locked: false },
          char_class: { value: anchors.charClass, locked: false },
          background: { value: anchors.background, locked: false },
          alignment: { value: anchors.alignment, locked: false },
          ...(anchors.level !== 1
            ? { level: { value: anchors.level, locked: false } }
            : {}),
        },
      });
      const prefix = playStylePromptPrefix(INITIAL.playStyle);
      const naming = namingConventionFor(anchors.race);
      const constraints = srdConstraintsFor(anchors);
      // Randomize always gets a hero seed — there's no user vibe to anchor it.
      const seed = frameHeroSeed(pickHeroSeed(2));
      const vibePayload = [prefix, naming, constraints, seed]
        .filter(Boolean)
        .join(" ")
        .trim();
      const result = await reroll.generate(created.id, vibePayload);
      const hero = await settleHero(
        created.id,
        result.character.sheet as Record<string, unknown>,
        result.character.name,
        false,
      );
      setRolledHero(hero);
      void playSfx("embers");
      setStage("done");
    } catch (e) {
      handleError(e);
    }
  }

  function dismissDialog() {
    const id = rolledId;
    setStage("idle");
    setRolledHero(null);
    setRolledId(null);
    if (id) router.push(`/table?character=${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden">
        <Hearth live={stage === "rolling"} />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-tavern-stone/25 bg-tavern-night/40 px-3 py-2">
          <span className="text-xs italic text-tavern-parchment/60">
            Want to skip the picks?
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={randomizeAll}
            disabled={stage === "rolling"}
          >
            <Dices className="h-3.5 w-3.5" />
            {stage === "rolling" ? "rolling…" : "let the fire roll it all"}
          </Button>
        </div>

        <div className="mt-6">
          <Wizard
            steps={steps}
            initialState={INITIAL}
            completeLabel={stage === "rolling" ? "rolling…" : "light the fire"}
            onComplete={complete}
          />
        </div>

        {error && (
          <Card compact className="mt-4 border-tavern-blood/50 bg-tavern-blood/10">
            <p className="flex items-start gap-2 text-sm text-tavern-blood">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          </Card>
        )}
      </Card>

      <p className="mt-4 text-center text-xs italic text-tavern-parchment/45">
        Existing heroes live at the{" "}
        <a
          href="/table"
          className="rounded text-tavern-gold/80 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold focus-visible:ring-offset-2 focus-visible:ring-offset-tavern-night"
        >
          Round Table
        </a>
        .
      </p>

      <RollingDialog
        open={stage === "rolling" || stage === "done"}
        stage={stage === "done" ? "done" : "rolling"}
        hero={rolledHero}
        whisper={whisper}
        onDismiss={dismissDialog}
      />
    </div>
  );
}

function Hearth({ live }: { live: boolean }) {
  return (
    <div className="relative mx-auto h-32 w-full overflow-hidden rounded-lg border border-tavern-stone/35 bg-gradient-to-b from-tavern-night via-[#1a1208] to-[#0a0604]">
      <div className="absolute inset-0 flex items-center justify-center">
        <Flame
          className={`h-12 w-12 ${live ? "flicker text-tavern-fire" : "breath text-tavern-fire/60"}`}
        />
      </div>
      {live && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 60%, rgba(240,160,80,0.35), transparent 60%)",
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
        />
      )}
      <p className="absolute inset-x-0 bottom-2 text-center text-[0.6rem] uppercase tracking-[0.3em] text-tavern-parchment/55">
        {live ? "the fire paints your hero" : "stoke the fire to roll a hero"}
      </p>
    </div>
  );
}
