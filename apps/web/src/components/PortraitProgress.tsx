"use client";

import { motion } from "framer-motion";
import { cn } from "@tomois/ui";
import type { PortraitStage } from "@/lib/api";

const STAGES: { key: PortraitStage; label: string; flavor: string }[] = [
  {
    key: "queued",
    label: "Queued",
    flavor: "The mirror gathers its will…",
  },
  {
    key: "painting",
    label: "Painting",
    flavor: "Strokes of light and shadow fall on the canvas.",
  },
  {
    key: "sculpting",
    label: "Sculpting",
    flavor: "A pixel-smith chips the portrait into a sprite.",
  },
  {
    key: "animating",
    label: "Animating",
    flavor: "Breath enters the sprite — frame by frame.",
  },
  {
    key: "ready",
    label: "Ready",
    flavor: "Admire your work.",
  },
];

const ORDER: PortraitStage[] = [
  "queued",
  "painting",
  "sculpting",
  "animating",
  "ready",
];

export function PortraitProgress({
  stage,
  failed,
  className,
}: {
  stage: PortraitStage | null;
  failed?: boolean;
  className?: string;
}) {
  const idx = stage ? Math.max(0, ORDER.indexOf(stage)) : 0;
  const pct = failed ? 100 : Math.round(((idx + 1) / ORDER.length) * 100);
  const current = STAGES[idx] ?? STAGES[0];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="font-heading text-xs uppercase tracking-[0.3em] text-tavern-gold">
          {failed ? "The vision fled" : current.label}
        </span>
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-tavern-parchment/50">
          {failed ? "failed" : `${pct}%`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-tavern-night/60">
        <motion.div
          className={cn(
            "h-full rounded-full",
            failed ? "bg-tavern-blood" : "bg-tavern-fire",
          )}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <p className="text-xs italic text-tavern-parchment/55">
        {failed ? "Speak the words again — the mirror tires sometimes." : current.flavor}
      </p>
    </div>
  );
}
