"use client";

import { ReactNode, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, cn } from "@tomois/ui";
import { settle } from "@/lib/motion";

/**
 * Generic multi-step wizard primitive.
 *
 * Each step describes its UI and validity; the Wizard owns the current index
 * and the shared state. The `onComplete` callback fires when the player
 * clicks the final step's complete button — the parent component is then
 * responsible for the actual API calls (the wizard does no I/O).
 *
 * See docs/DESIGN.md §11 (Wizard pattern, planned addition).
 */

export interface WizardStep<S> {
  /** Stable id (used as React key + visible in the progress strip on dev). */
  id: string;
  /** Title for this step. */
  title: string;
  /** Optional flavor line under the title. */
  flavor?: ReactNode;
  /** Optional flag: this step can be skipped (Next becomes "Skip"). */
  optional?: boolean;
  /** Return true if Next should be enabled. Defaults to true. */
  isValid?: (state: S) => boolean;
  /**
   * Return false to hide this step from the wizard for the current state.
   * Used for class-conditional steps (e.g. SpellsStep only for casters).
   * Defaults to always-show.
   */
  shouldShow?: (state: S) => boolean;
  /** Render the step body. */
  render: (state: S, set: (patch: Partial<S>) => void) => ReactNode;
}

export interface WizardProps<S> {
  steps: WizardStep<S>[];
  initialState: S;
  /**
   * Called when the player clicks the final-step button. Receives the
   * fully-merged state. May be async — the wizard disables its buttons
   * while the promise is pending.
   */
  onComplete: (state: S) => void | Promise<void>;
  /** Label for the final step's complete button. Defaults to "Done". */
  completeLabel?: string;
  /** Label for the intermediate Next button. Defaults to "Next". */
  nextLabel?: string;
  /** Override the top of the wizard (e.g. for hearth animation in Fireplace). */
  header?: ReactNode;
  className?: string;
}

export function Wizard<S>({
  steps,
  initialState,
  onComplete,
  completeLabel = "Done",
  nextLabel = "Next",
  header,
  className,
}: WizardProps<S>) {
  const [state, setState] = useState<S>(initialState);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const visible = steps.filter((s) => !s.shouldShow || s.shouldShow(state));
  // If the current index lands on a now-hidden step, snap forward.
  const safeIndex = Math.min(index, steps.length - 1);
  const stepAtIndex = steps[safeIndex];
  const stepIsVisible =
    !stepAtIndex.shouldShow || stepAtIndex.shouldShow(state);
  const step = stepIsVisible
    ? stepAtIndex
    : (visible[Math.min(safeIndex, visible.length - 1)] ?? steps[0]);
  const visibleIdx = Math.max(
    0,
    visible.findIndex((s) => s.id === step.id),
  );
  const isLast = visibleIdx === visible.length - 1;
  const valid = step.isValid ? step.isValid(state) : true;

  const set = useCallback((patch: Partial<S>) => {
    setState((cur) => ({ ...cur, ...patch }));
  }, []);

  function nextVisible(from: number): number {
    for (let i = from + 1; i < steps.length; i++) {
      const s = steps[i];
      if (!s.shouldShow || s.shouldShow(state)) return i;
    }
    return from;
  }
  function prevVisible(from: number): number {
    for (let i = from - 1; i >= 0; i--) {
      const s = steps[i];
      if (!s.shouldShow || s.shouldShow(state)) return i;
    }
    return from;
  }

  async function next() {
    if (submitting) return;
    if (isLast) {
      try {
        setSubmitting(true);
        await onComplete(state);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const here = steps.findIndex((s) => s.id === step.id);
    setIndex(nextVisible(here));
  }

  function back() {
    if (submitting) return;
    const here = steps.findIndex((s) => s.id === step.id);
    setIndex(prevVisible(here));
  }

  function skip() {
    if (submitting || !step.optional || isLast) return;
    const here = steps.findIndex((s) => s.id === step.id);
    setIndex(nextVisible(here));
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {header}

      {/* Progress strip */}
      <div
        role="group"
        aria-label="Wizard progress"
        className="flex items-center gap-1.5"
      >
        {visible.map((s, i) => {
          const done = i < visibleIdx;
          const active = i === visibleIdx;
          return (
            <div
              key={s.id}
              className="flex-1"
              aria-current={active ? "step" : undefined}
            >
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  done && "bg-tavern-gold",
                  active && "bg-tavern-fire",
                  !done && !active && "bg-tavern-stone/25",
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="font-heading text-[0.6rem] uppercase tracking-[0.3em] text-tavern-parchment/50">
          step {visibleIdx + 1} of {visible.length}
        </span>
        {step.optional && (
          <span className="text-[0.6rem] italic text-tavern-parchment/45">
            optional
          </span>
        )}
      </div>

      {/* Step body */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.id}
          variants={settle}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.12 } }}
        >
          <h2 className="font-heading text-xl uppercase tracking-[0.25em] text-tavern-gold">
            {step.title}
          </h2>
          {step.flavor && (
            <p className="mt-1 text-sm italic text-tavern-parchment/65">
              {step.flavor}
            </p>
          )}
          <div className="mt-5">{step.render(state, set)}</div>
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button
          variant="ghost"
          onClick={back}
          disabled={index === 0 || submitting}
          aria-label="Back to previous step"
        >
          back
        </Button>
        <div className="flex items-center gap-2">
          {step.optional && !isLast && (
            <Button variant="secondary" onClick={skip} disabled={submitting}>
              skip
            </Button>
          )}
          <Button onClick={next} disabled={!valid || submitting}>
            {submitting
              ? "…"
              : isLast
                ? completeLabel
                : nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
