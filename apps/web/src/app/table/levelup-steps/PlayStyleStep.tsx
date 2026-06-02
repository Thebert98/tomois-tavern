"use client";

import { PlayStylePicker } from "@/components/wizard/PlayStylePicker";
import { recommendedAbilities } from "@/lib/playstyle";
import { ABILITY_LABEL } from "@/lib/srd";
import type { LevelUpState } from "./types";

export function PlayStyleStep({
  state,
  set,
}: {
  state: LevelUpState;
  set: (patch: Partial<LevelUpState>) => void;
}) {
  const rec = recommendedAbilities(state.playStyle, state.charClass);
  return (
    <div className="space-y-4">
      <PlayStylePicker
        value={state.playStyle}
        onChange={(s) => set({ playStyle: s })}
      />
      {(rec.primary || rec.secondary) && (
        <p className="text-xs italic text-tavern-parchment/55">
          For a {state.playStyle} {state.charClass || "build"}, lean on{" "}
          <span className="text-tavern-gold">
            {rec.primary ? ABILITY_LABEL[rec.primary] : ""}
            {rec.secondary ? ` + ${ABILITY_LABEL[rec.secondary]}` : ""}
          </span>
          . The ASI step will highlight bumps that match.
        </p>
      )}
      {state.playStyle === "lore" && (
        <p className="text-xs italic text-tavern-parchment/55">
          The fire will lean on the existing backstory + your notes to
          decide; ASI bumps stay your call.
        </p>
      )}
    </div>
  );
}
