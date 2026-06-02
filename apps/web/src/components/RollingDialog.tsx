"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { Button, Chip } from "@tomois/ui";

/**
 * Hearth-themed full-screen overlay used by the Fireplace and the Round
 * Table's level-up whenever the LLM is actively generating. Two visual
 * states:
 *
 *   - "rolling" — flickering flame icon over an indeterminate hearth
 *     progress bar, with a label that cycles every couple of seconds
 *     ("kindling the fire…", "shaping the hero…", …) so the player has
 *     a sense of motion. The user's vibe / notes appear below in italics.
 *
 *   - "done" — the flame is steady and the hero's name + race · class ·
 *     level row settle in. A "step into the tavern" button dismisses.
 *
 * Routing is the caller's job — this component never navigates; it just
 * fires `onDismiss` when the player clicks the dismiss button.
 */

export type RollingStage = "rolling" | "done";

export interface RollingHero {
  name: string;
  race?: string;
  charClass?: string;
  level?: number;
  /** Optional flavor — currently unused but reserved for portrait thumb. */
  portrait?: string | null;
}

export interface RollingDialogProps {
  open: boolean;
  stage: RollingStage;
  hero?: RollingHero | null;
  /** Optional player vibe / notes — shown italicized below the progress. */
  whisper?: string;
  /** Override the cycling rolling-stage labels. */
  stages?: string[];
  /** Title on the done banner. Defaults to "steps from the fire." */
  doneCaption?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
}

const DEFAULT_STAGES = [
  "kindling the fire…",
  "shaping the hero…",
  "weaving their tale…",
  "binding their soul…",
  "the fire crowns them…",
];

export function RollingDialog({
  open,
  stage,
  hero,
  whisper,
  stages = DEFAULT_STAGES,
  doneCaption = "steps from the fire.",
  onDismiss,
  dismissLabel = "step into the tavern",
}: RollingDialogProps) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (!open || stage !== "rolling") {
      setStageIdx(0);
      return;
    }
    const t = window.setInterval(() => {
      setStageIdx((i) => (i + 1) % stages.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [open, stage, stages.length]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-label={stage === "rolling" ? "Generating hero" : "Hero ready"}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-tavern-night/85 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-md rounded-xl border border-tavern-stone/35 bg-gradient-to-b from-[#1a120a] via-[#100a06] to-[#080503] p-8 shadow-2xl"
          >
            {/* Flame */}
            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              {/* Outer glow */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(240,160,80,0.35) 0%, rgba(240,160,80,0) 70%)",
                }}
              />
              <Flame
                className={`relative h-16 w-16 ${
                  stage === "rolling"
                    ? "flicker text-tavern-fire"
                    : "text-tavern-fire"
                }`}
                aria-hidden
              />
            </div>

            {stage === "rolling" ? (
              <RollingBody label={stages[stageIdx]} whisper={whisper} />
            ) : (
              <DoneBody
                hero={hero ?? null}
                caption={doneCaption}
                onDismiss={onDismiss}
                dismissLabel={dismissLabel}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RollingBody({
  label,
  whisper,
}: {
  label: string;
  whisper?: string;
}) {
  return (
    <div className="text-center">
      <div className="hearth-progress mx-auto h-1.5 w-full max-w-xs rounded-full" />
      <AnimatePresence mode="wait">
        <motion.p
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="mt-4 font-heading text-xs uppercase tracking-[0.3em] text-tavern-gold"
        >
          {label}
        </motion.p>
      </AnimatePresence>
      {whisper && (
        <p className="mx-auto mt-3 max-w-[28ch] text-xs italic text-tavern-parchment/55">
          &ldquo;{whisper}&rdquo;
        </p>
      )}
    </div>
  );
}

function DoneBody({
  hero,
  caption,
  onDismiss,
  dismissLabel,
}: {
  hero: RollingHero | null;
  caption: string;
  onDismiss?: () => void;
  dismissLabel: string;
}) {
  return (
    <div className="text-center">
      <h2 className="font-heading text-2xl uppercase tracking-[0.2em] text-tavern-gold">
        {hero?.name || "A hero"}
      </h2>
      {(hero?.race || hero?.charClass || typeof hero?.level === "number") && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {hero?.race && <Chip>{hero.race}</Chip>}
          {hero?.charClass && <Chip>{hero.charClass}</Chip>}
          {typeof hero?.level === "number" && (
            <Chip tone="active">lvl {hero.level}</Chip>
          )}
        </div>
      )}
      <p className="mt-3 text-sm italic text-tavern-parchment/65">{caption}</p>
      {onDismiss && (
        <Button
          onClick={onDismiss}
          className="mt-5 mx-auto"
        >
          {dismissLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
