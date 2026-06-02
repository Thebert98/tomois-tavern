"use client";

import { Input, Label } from "@tomois/ui";
import {
  ABILITY_LABEL,
  BACKGROUND_NAMES,
  BACKGROUNDS,
  CLASS_INFO,
  CLASS_NAMES,
  RACE_NAMES,
  RACES,
  type Ability,
} from "@/lib/srd";
import type { FireplaceState } from "../FireplaceWizard";

function asiSummary(race: string): string {
  const bumps = RACES[race] ?? {};
  const parts = (Object.entries(bumps) as [Ability, number][])
    .map(([ab, n]) => `+${n} ${ABILITY_LABEL[ab]}`);
  return parts.length ? parts.join(", ") : "no ASI";
}

function classSummary(name: string): string {
  const info = CLASS_INFO[name];
  if (!info) return "";
  const caster =
    info.caster === "none"
      ? "non-caster"
      : info.caster === "pact"
        ? "pact caster"
        : info.caster === "half"
          ? `half caster · ${ABILITY_LABEL[info.ability!]}`
          : `full caster · ${ABILITY_LABEL[info.ability!]}`;
  return `d${info.hitDie} · ${caster}`;
}

function backgroundSummary(name: string): string {
  const skills = BACKGROUNDS[name] ?? [];
  return skills.length ? `grants ${skills.join(" + ")}` : "";
}

export function IdentityStep({
  state,
  set,
}: {
  state: FireplaceState;
  set: (patch: Partial<FireplaceState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="hero-name">Name</Label>
        <Input
          id="hero-name"
          autoFocus
          placeholder="Kael Stormbreaker"
          value={state.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PickerSelect
          id="hero-race"
          label="Race"
          value={state.race}
          options={RACE_NAMES}
          describe={asiSummary}
          placeholder="Pick a heritage (optional)"
          onChange={(v) => set({ race: v })}
        />

        <PickerSelect
          id="hero-class"
          label="Class"
          value={state.char_class}
          options={CLASS_NAMES}
          describe={classSummary}
          placeholder="Pick a calling"
          onChange={(v) => set({ char_class: v })}
        />
      </div>

      <PickerSelect
        id="hero-background"
        label="Background"
        value={state.background}
        options={BACKGROUND_NAMES}
        describe={backgroundSummary}
        placeholder="Pick a past (optional)"
        onChange={(v) => set({ background: v })}
      />

      {state.race && state.char_class && (
        <p className="text-xs italic text-tavern-parchment/55">
          You bring a {state.race} {state.char_class}
          {state.background ? `, raised as a ${state.background}` : ""}.
        </p>
      )}
    </div>
  );
}

function PickerSelect({
  id,
  label,
  value,
  options,
  describe,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  describe: (name: string) => string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-tavern-stone/35 bg-tavern-night px-3 py-2 text-sm text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt} — {describe(opt)}
          </option>
        ))}
      </select>
    </div>
  );
}
