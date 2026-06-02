"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Flame } from "lucide-react";
import { Card, useToast } from "@tomois/ui";
import { Wizard, type WizardStep } from "@/components/wizard/Wizard";
import { reroll } from "@/lib/api";
import { sheetFromPicks } from "@/lib/sheet";
import { playSfx } from "@/lib/sfx";
import {
  ABILITIES,
  applyRaceASI,
  CLASS_INFO,
  type Ability,
} from "@/lib/srd";
import { IdentityStep } from "./steps/IdentityStep";
import { AlignmentLevelStep } from "./steps/AlignmentLevelStep";
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
};

function statsComplete(state: FireplaceState): boolean {
  if (!state.statsMethod) return false;
  const minVal = state.statsMethod === "pointbuy" ? 8 : 1;
  return ABILITIES.every((ab) => (state.stats[ab] ?? 0) >= minVal);
}

function isCaster(charClass: string): boolean {
  return (CLASS_INFO[charClass]?.caster ?? "none") !== "none";
}

export function FireplaceWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "rolling">("idle");

  const steps: WizardStep<FireplaceState>[] = [
    {
      id: "identity",
      title: "Who are you?",
      flavor: "Pick a name and a calling. Race and background are optional — the fire fills the rest.",
      isValid: (s) => s.name.trim().length > 0 && s.char_class.trim().length > 0,
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
      id: "stats",
      title: "What sharpens your edge?",
      flavor: "Pick a method, then place the numbers. Race bonuses are layered on top.",
      isValid: (s) => statsComplete(s),
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

  async function complete(state: FireplaceState) {
    const name = state.name.trim();
    if (!name) {
      toast("Give the hero a name first.", { tone: "error" });
      return;
    }
    setError(null);
    setStage("rolling");
    try {
      const created = await reroll.createCharacter(name);
      const resolvedStats = statsComplete(state)
        ? applyRaceASI(state.race, state.stats)
        : null;
      const spellsPicked =
        isCaster(state.char_class) && !state.autoSpells && state.spells.length > 0;
      const picks: Record<string, unknown> = {
        name,
        race: state.race,
        char_class: state.char_class,
        background: state.background,
        alignment: state.alignment,
        level: state.level !== 1 ? state.level : null,
        stats: resolvedStats,
        spells: spellsPicked ? state.spells : null,
      };
      const sheet = sheetFromPicks(picks, state.locks);
      if (Object.keys(sheet).length > 0) {
        await reroll.update(created.id, { sheet });
      }
      await reroll.generate(created.id, state.vibe.trim());
      void playSfx("embers");
      toast(`${name} steps from the fire.`, { tone: "success" });
      router.push(`/table?character=${created.id}`);
    } catch (e) {
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
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden">
        <Hearth live={stage === "rolling"} />

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
        <a href="/table" className="text-tavern-gold/80 hover:text-tavern-gold">
          Round Table
        </a>
        .
      </p>
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
