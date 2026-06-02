"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UserPlus, Flame } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Modal,
  Skeleton,
  useToast,
} from "@tomois/ui";
import {
  reroll,
  workshop,
  type PortraitDTO,
  type RerollCharacter,
} from "@/lib/api";
import { playSfx } from "@/lib/sfx";
import { CharacterCard } from "./CharacterCard";

export function RoundTable() {
  const router = useRouter();
  const { toast } = useToast();
  const [characters, setCharacters] = useState<RerollCharacter[] | null>(null);
  const [portraits, setPortraits] = useState<PortraitDTO[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<RerollCharacter | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

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

  async function createHero() {
    const name = newName.trim() || "Untitled";
    try {
      await reroll.createCharacter(name);
      void playSfx("embers");
      toast("A new hero takes a seat at the table.", { tone: "success" });
      setCreating(false);
      setNewName("");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't seat the hero.", {
        tone: "error",
      });
    }
  }

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

  // Edit + level-up land properly in PR 4 / PR 5. For this PR the chips are
  // present + clickable; edit routes to the existing Fireplace editor so
  // nothing regresses, level-up surfaces a friendly placeholder.
  function onEdit(c: RerollCharacter) {
    router.push(`/fireplace?character=${c.id}`);
  }
  function onLevelUp(_c: RerollCharacter) {
    toast("The next chapter is being written — coming soon.", {
      tone: "info",
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-2">
        <p className="text-sm italic text-tavern-parchment/65">
          Every hero you&apos;ve seated, across every campaign.
        </p>
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4" />
          seat a new hero
        </Button>
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
          description="No heroes yet — seat one and they'll appear here."
          action={
            <Button onClick={() => setCreating(true)}>
              <UserPlus className="h-4 w-4" />
              seat the first hero
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              portrait={portraitByCharacter.get(c.id) ?? null}
              onEdit={() => onEdit(c)}
              onLevelUp={() => onLevelUp(c)}
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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Seat a new hero"
        description="A new sheet is opened. Roll the rest at the Fireplace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              cancel
            </Button>
            <Button onClick={createHero}>seat them</Button>
          </>
        }
      >
        <div>
          <Label htmlFor="new-hero-name">Name</Label>
          <Input
            id="new-hero-name"
            placeholder="e.g. Kael Stormbreaker"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
}
