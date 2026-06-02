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

  const total = steps.length;
  const step = steps[index];
  const isLast = index === total - 1;
  const valid = step.isValid ? step.isValid(state) : true;

  const set = useCallback((patch: Partial<S>) => {
    setState((cur) => ({ ...cur, ...patch }));
  }, []);

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
    setIndex((i) => Math.min(total - 1, i + 1));
  }

  function back() {
    if (submitting) return;
    setIndex((i) => Math.max(0, i - 1));
  }

  function skip() {
    if (submitting || !step.optional || isLast) return;
    setIndex((i) => Math.min(total - 1, i + 1));
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
        {steps.map((s, i) => {
          const done = i < index;
          const active = i === index;
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
          step {index + 1} of {total}
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
