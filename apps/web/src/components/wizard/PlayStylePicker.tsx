"use client";

import { HeartPulse, Scale, ScrollText, Shield, Swords } from "lucide-react";
import { cn } from "@tomois/ui";
import { PLAY_STYLES, type PlayStyle, type PlayStyleInfo } from "@/lib/playstyle";

const ICONS: Record<PlayStyleInfo["icon"], React.ComponentType<{ className?: string }>> = {
  scale: Scale,
  "heart-pulse": HeartPulse,
  shield: Shield,
  swords: Swords,
  "scroll-text": ScrollText,
};

export function PlayStylePicker({
  value,
  onChange,
}: {
  value: PlayStyle;
  onChange: (s: PlayStyle) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {PLAY_STYLES.map((s) => {
        const Icon = ICONS[s.icon];
        const active = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            aria-pressed={active}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
              active
                ? "border-tavern-gold/80 bg-tavern-gold/15"
                : "border-tavern-stone/35 bg-tavern-night/50 hover:border-tavern-gold/55",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-tavern-gold" : "text-tavern-parchment/70",
                )}
              />
              <span
                className={cn(
                  "font-heading text-xs uppercase tracking-[0.25em]",
                  active ? "text-tavern-gold" : "text-tavern-parchment",
                )}
              >
                {s.label}
              </span>
            </div>
            <p className="mt-1 text-[0.7rem] italic text-tavern-parchment/60">
              {s.blurb}
            </p>
          </button>
        );
      })}
    </div>
  );
}
