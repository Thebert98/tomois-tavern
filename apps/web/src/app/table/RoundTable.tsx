"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  Skeleton,
  useToast,
} from "@tomois/ui";
import {
  reroll,
  workshop,
  type PortraitDTO,
  type RerollCharacter,
} from "@/lib/api";
import { CharacterCard } from "./CharacterCard";
import { EditCharacterModal } from "./EditCharacterModal";
import { LevelUpWizard } from "./LevelUpWizard";

export function RoundTable() {
  const { toast } = useToast();
  const [characters, setCharacters] = useState<RerollCharacter[] | null>(null);
  const [portraits, setPortraits] = useState<PortraitDTO[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<RerollCharacter | null>(
    null,
  );
  const [editing, setEditing] = useState<RerollCharacter | null>(null);
  const [levelUp, setLevelUp] = useState<RerollCharacter | null>(null);

  async function refresh() {
    const [chars, ports] = await Promise.all([
      reroll.listCharacters().catch(() => [] as RerollCharacter[]),
      workshop.listPortraits().catch(() => [] as PortraitDTO[]),
    ]);
    setCharacters(chars);
    setPortraits(ports);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const portraitByCharacter = useMemo(() => {
    const map = new Map<string, PortraitDTO>();
    for (const p of portraits) {
      if (p.is_current && p.character_id) map.set(p.character_id, p);
    }
    return map;
  }, [portraits]);

  async function deleteHero(c: RerollCharacter) {
    try {
      await reroll.deleteCharacter(c.id);
      toast(`${c.name} has left the table.`, { tone: "success" });
      setCharacters((list) => (list ?? []).filter((x) => x.id !== c.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not banish the hero.", {
        tone: "error",
      });
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-2">
        <p className="text-sm italic text-tavern-parchment/65">
          Every hero you&apos;ve seated, across every campaign.
        </p>
        <Link
          href="/fireplace"
          className="inline-flex items-center gap-2 rounded-lg bg-tavern-ember px-3.5 py-2 font-heading text-xs uppercase tracking-[0.22em] text-tavern-night shadow-[0_8px_24px_-12px_rgba(240,160,80,0.65)] transition-colors hover:bg-tavern-fire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold focus-visible:ring-offset-2 focus-visible:ring-offset-tavern-night"
        >
          <Flame className="h-4 w-4" />
          roll a new hero
        </Link>
      </div>

      {characters === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <EmptyState
          icon={<Flame className="h-7 w-7" />}
          title="The table is empty"
          description="No heroes yet — visit the Fireplace and stoke the embers."
          action={
            <Link
              href="/fireplace"
              className="inline-flex items-center gap-2 rounded-lg bg-tavern-ember px-3.5 py-2 font-heading text-xs uppercase tracking-[0.22em] text-tavern-night transition-colors hover:bg-tavern-fire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
            >
              <Flame className="h-4 w-4" />
              roll the first hero
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              portrait={portraitByCharacter.get(c.id) ?? null}
              onEdit={() => setEditing(c)}
              onLevelUp={() => setLevelUp(c)}
              onBanish={() => setConfirmDelete(c)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await deleteHero(confirmDelete);
        }}
        title={`Banish ${confirmDelete?.name ?? "this hero"}?`}
        description="The sheet, portraits, and version history are wiped. This cannot be undone."
        confirmLabel="Banish"
        cancelLabel="Keep"
      />

      <EditCharacterModal
        character={editing}
        onClose={() => setEditing(null)}
        onChanged={() => void refresh()}
      />

      <LevelUpWizard
        character={levelUp}
        onClose={() => setLevelUp(null)}
        onChanged={() => void refresh()}
      />
    </>
  );
}
