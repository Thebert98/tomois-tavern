"use client";

import { Flame } from "lucide-react";
import { Label, Textarea } from "@tomois/ui";
import type { FireplaceState } from "../FireplaceWizard";

/**
 * Final step. Vibe textarea + a parting line about what the fire fills in.
 * The wizard's footer button submits — there's no separate button here.
 */
export function SealStep({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-tavern-stone/30 bg-tavern-night/40 px-3 py-2 text-xs text-tavern-parchment/70">
        <Flame className="mt-0.5 h-3 w-3 shrink-0 text-tavern-fire" />
        <p>
          Last whisper to the fire. Anything you didn&apos;t specify — equipment,
          backstory, personality — the fire decides for you.
        </p>
      </div>

      <div>
        <Label htmlFor="hero-vibe">Whisper to the fire (optional)</Label>
        <Textarea
          id="hero-vibe"
          rows={4}
          placeholder="e.g. a tragic backstory tied to the burned harbor; lean spell-heavy."
          value={state.vibe}
          onChange={(e) => set({ vibe: e.target.value })}
        />
      </div>

      <p className="text-center text-[0.65rem] italic text-tavern-parchment/55">
        when you light the fire, the hearth paints your hero.
      </p>
    </div>
  );
}
