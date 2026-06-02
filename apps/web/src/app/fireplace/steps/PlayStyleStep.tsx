"use client";

import { PlayStylePicker } from "@/components/wizard/PlayStylePicker";
import { recommendedAbilities } from "@/lib/playstyle";
import { ABILITY_LABEL } from "@/lib/srd";
import type { FireplaceState } from "../FireplaceWizard";

export function PlayStyleStep({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  const rec = recommendedAbilities(state.playStyle, state.char_class);
  return (
    <div className="space-y-4">
      <PlayStylePicker
        value={state.playStyle}
        onChange={(s) => set({ playStyle: s })}
      />
      {(rec.primary || rec.secondary) && (
        <p className="text-xs italic text-tavern-parchment/55">
          {state.char_class || "Your"} +{" "}
          {state.playStyle === "tank"
            ? "tank"
            : state.playStyle === "support"
              ? "support"
              : "damage"}{" "}
          leans on{" "}
          <span className="text-tavern-gold">
            {rec.primary ? ABILITY_LABEL[rec.primary] : ""}
            {rec.secondary ? ` + ${ABILITY_LABEL[rec.secondary]}` : ""}
          </span>
          . The Stats step will mark these as recommended.
        </p>
      )}
      {state.playStyle === "lore" && (
        <p className="text-xs italic text-tavern-parchment/55">
          The fire will lean on your vibe text to decide stat priorities and
          spell picks. Be specific in the Seal step.
        </p>
      )}
    </div>
  );
}
