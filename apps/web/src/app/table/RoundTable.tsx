"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Sparkles, Trash2, UserPlus, Flame } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Modal,
  Skeleton,
  useToast,
} from "@tomois/ui";
import { reroll, workshop, type PortraitDTO, type RerollCharacter } from "@/lib/api";
import { playSfx } from "@/lib/sfx";

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

export function RoundTable() {
  const { toast } = useToast();
  const [characters, setCharacters] = useState<RerollCharacter[] | null>(null);
  const [portraits, setPortraits] = useState<PortraitDTO[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<RerollCharacter | null>(null);
  const [renaming, setRenaming] = useState<RerollCharacter | null>(null);
  const [renameValue, setRenameValue] = useState("");
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

  async function renameHero() {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name || name === renaming.name) {
      setRenaming(null);
      return;
    }
    try {
      await reroll.renameCharacter(renaming.id, name);
      toast(`Re-named to ${name}.`, { tone: "success" });
      setRenaming(null);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Re-name failed.", {
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
            <Skeleton key={i} className="h-40 rounded-xl" />
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
          {characters.map((c) => {
            const portrait = portraitByCharacter.get(c.id) ?? null;
            const summary = describe(c.sheet);
            return (
              <Card key={c.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar
                    size="lg"
                    name={c.name || "Untitled"}
                    src={portrait?.image_url ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-heading text-base uppercase tracking-[0.2em] text-tavern-parchment">
                      {c.name || "Untitled"}
                    </div>
                    {summary ? (
                      <div className="mt-1 truncate text-xs italic text-tavern-parchment/65">
                        {summary}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs italic text-tavern-stone">
                        sheet not yet rolled
                      </div>
                    )}
                    {portrait ? (
                      <Chip tone="active" className="mt-2">
                        <Sparkles className="h-3 w-3" />
                        portrait set
                      </Chip>
                    ) : (
                      <Chip tone="muted" className="mt-2">
                        no portrait yet
                      </Chip>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/fireplace?character=${c.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/70 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
                  >
                    <Flame className="h-3 w-3" />
                    sheet
                  </Link>
                  <Link
                    href="/mirror"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/70 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
                  >
                    <Sparkles className="h-3 w-3" />
                    mirror
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(c);
                      setRenameValue(c.name || "");
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/70 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
                  >
                    <Pencil className="h-3 w-3" />
                    rename
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(c)}
                    aria-label={`Banish ${c.name}`}
                    className="ml-auto inline-flex items-center gap-1 rounded-md p-1.5 text-tavern-parchment/55 hover:bg-tavern-blood/30 hover:text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-blood"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
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

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename hero"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              cancel
            </Button>
            <Button onClick={renameHero}>save</Button>
          </>
        }
      >
        <div>
          <Label htmlFor="rename-input">New name</Label>
          <Input
            id="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
}
