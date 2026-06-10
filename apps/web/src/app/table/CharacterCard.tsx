"use client";

import Link from "next/link";
import {
  ChevronUp,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card, Chip, Initials, cn } from "@tomois/ui";
import type { PortraitDTO, RerollCharacter } from "@/lib/api";

function pickField(sheet: Record<string, unknown>, key: string): string {
  const f = sheet[key] as { value?: unknown } | undefined;
  if (typeof f?.value === "string") return f.value;
  if (typeof f?.value === "number") return String(f.value);
  return "";
}

function describe(sheet: Record<string, unknown>): string {
  const parts = [
    pickField(sheet, "race"),
    pickField(sheet, "char_class"),
    pickField(sheet, "level") ? `lvl ${pickField(sheet, "level")}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

export interface CharacterCardProps {
  character: RerollCharacter;
  portrait: PortraitDTO | null;
  onEdit: () => void;
  onLevelUp: () => void;
  onBanish: () => void;
}

/**
 * Roster card — paints the active portrait at its proper 3:4 aspect rather
 * than cropping it into a circle. Layout shifts: mobile stacks portrait on
 * top of meta; ≥ sm puts a fixed-width portrait at the left and meta to its
 * right. Falls back to an Initials block over tavern-oak when no portrait.
 */
export function CharacterCard({
  character: c,
  portrait,
  onEdit,
  onLevelUp,
  onBanish,
}: CharacterCardProps) {
  const summary = describe(c.sheet);
  const name = c.name || "Untitled";

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col sm:flex-row">
        {/* Portrait — fills card width on mobile, fixed strip on ≥ sm */}
        <div className="relative aspect-[3/4] w-full overflow-hidden sm:aspect-auto sm:h-auto sm:w-40 sm:shrink-0">
          {portrait?.image_url ? (
            <img
              src={portrait.image_url}
              alt={`${name} portrait`}
              loading="lazy"
              decoding="async"
              className={cn(
                "h-full w-full object-cover",
                portrait.is_current &&
                  "ring-2 ring-inset ring-tavern-gold/70 shadow-[inset_0_0_24px_rgba(212,175,55,0.35)]",
              )}
            />
          ) : (
            <Initials
              name={name}
              className="h-full w-full text-3xl sm:text-4xl"
            />
          )}
          {portrait?.is_current && (
            <span className="absolute left-2 top-2 rounded bg-tavern-gold/90 px-1.5 py-0.5 font-heading text-[0.55rem] uppercase tracking-[0.2em] text-tavern-night">
              active
            </span>
          )}
        </div>

        {/* Meta + actions */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <h3 className="truncate font-heading text-base uppercase tracking-[0.2em] text-tavern-parchment">
              {name}
            </h3>
            {summary ? (
              <p className="mt-1 truncate text-xs italic text-tavern-parchment/65">
                {summary}
              </p>
            ) : (
              <p className="mt-1 text-xs italic text-tavern-stone">
                sheet not yet rolled
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {portrait ? (
                <Chip tone={portrait.is_current ? "active" : "default"}>
                  <Sparkles className="h-3 w-3" />
                  {portrait.is_current ? "vision set" : "vision drafted"}
                </Chip>
              ) : (
                <Chip tone="muted">no vision yet</Chip>
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/70 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
            >
              <Pencil className="h-3 w-3" />
              edit
            </button>
            <button
              type="button"
              onClick={onLevelUp}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/70 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
            >
              <ChevronUp className="h-3 w-3" />
              level up
            </button>
            <Link
              href="/mirror"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/70 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
            >
              <Sparkles className="h-3 w-3" />
              mirror
            </Link>
            <button
              type="button"
              onClick={onBanish}
              aria-label={`Banish ${name}`}
              className="ml-auto inline-flex items-center gap-1 rounded-md p-1.5 text-tavern-parchment/55 hover:bg-tavern-blood/30 hover:text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-blood"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
