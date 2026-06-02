"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  Wand2,
  Check,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Label,
  Skeleton,
  Textarea,
  useToast,
} from "@tomois/ui";
import { reroll, workshop, type PortraitDTO } from "@/lib/api";
import { PortraitProgress } from "@/components/PortraitProgress";
import { supabaseBrowser } from "@/lib/supabase/client";
import { playSfx } from "@/lib/sfx";

interface Character {
  id: string;
  name: string;
  sheet: Record<string, unknown>;
}

function characterFlavor(sheet: Record<string, unknown>): string {
  const pick = (key: string) => {
    const f = sheet[key] as { value?: unknown } | undefined;
    return typeof f?.value === "string" ? f.value : "";
  };
  return [pick("race"), pick("char_class"), pick("background"), pick("alignment")]
    .filter(Boolean)
    .join(", ");
}

export function MirrorRoom() {
  const { toast } = useToast();
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [chosen, setChosen] = useState<Character | null>(null);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inFlight, setInFlight] = useState<PortraitDTO | null>(null);
  const [allPortraits, setAllPortraits] = useState<PortraitDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PortraitDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      reroll.listCharacters().catch(() => [] as Character[]),
      workshop.listPortraits().catch(() => [] as PortraitDTO[]),
    ]).then(([chars, portraits]) => {
      if (cancelled) return;
      setCharacters(chars);
      setAllPortraits(portraits);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chosen) {
      setPrompt("");
      setInFlight(null);
      return;
    }
    const flavor = characterFlavor(chosen.sheet);
    setPrompt(
      `Portrait of ${chosen.name}${flavor ? `, ${flavor}` : ""}. ` +
        "Painterly fantasy oil-painting style, warm tavern lighting, " +
        "dramatic shadows, head-and-shoulders composition.",
    );
  }, [chosen]);

  useEffect(() => {
    if (!inFlight) return;
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`portrait:${inFlight.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "portraits",
          filter: `id=eq.${inFlight.id}`,
        },
        (payload) => {
          const next = payload.new as PortraitDTO;
          setInFlight(next);
          setAllPortraits((list) => {
            const base = list ?? [];
            const exists = base.some((p) => p.id === next.id);
            return exists
              ? base.map((p) => (p.id === next.id ? next : p))
              : [next, ...base];
          });
          if (next.stage === "ready") {
            void playSfx("chime");
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [inFlight?.id]);

  const gallery = useMemo(
    () =>
      chosen && allPortraits
        ? allPortraits.filter((p) => p.character_id === chosen.id)
        : [],
    [allPortraits, chosen],
  );
  const current = useMemo(
    () => gallery.find((p) => p.is_current) ?? null,
    [gallery],
  );

  const display = inFlight ?? current;
  const isPipelineLive =
    !!inFlight && inFlight.stage !== "ready" && inFlight.stage !== "failed";

  async function cast() {
    if (!chosen) return;
    setSubmitting(true);
    setError(null);
    try {
      const portrait = await workshop.createPortrait({
        character_id: chosen.id,
        prompt,
      });
      setInFlight(portrait);
      setAllPortraits((g) => [portrait, ...(g ?? [])]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast("The mirror tires — try again.", { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function setActive(id: string) {
    try {
      const updated = await workshop.setCurrentPortrait(id);
      setAllPortraits((list) =>
        (list ?? []).map((p) =>
          p.character_id === updated.character_id
            ? { ...p, is_current: p.id === id }
            : p,
        ),
      );
      void playSfx("mug");
      toast("This vision now leads the hero.", { tone: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast("Couldn't change the active vision.", { tone: "error" });
    }
  }

  async function deletePortrait(id: string) {
    try {
      await workshop.deletePortrait(id);
      setAllPortraits((list) => (list ?? []).filter((p) => p.id !== id));
      if (inFlight?.id === id) setInFlight(null);
      toast("A vision was banished from the gallery.", { tone: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast("The mirror clung to it — couldn't delete.", { tone: "error" });
    }
  }

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <MirrorFrame submitting={isPipelineLive} portrait={display} />
          {inFlight && inFlight.stage !== "ready" && (
            <div className="mx-auto mt-6 max-w-md">
              <PortraitProgress
                stage={inFlight.stage}
                failed={inFlight.status === "failed"}
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-6">
          <CharacterPicker
            characters={characters}
            chosen={chosen}
            onPick={setChosen}
          />

          {chosen ? (
            <>
              <div>
                <Label htmlFor="mirror-prompt">
                  What does the mirror reveal?
                </Label>
                <Textarea
                  id="mirror-prompt"
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A weather-beaten half-elven ranger with silver braids…"
                />
              </div>

              <Button
                size="lg"
                onClick={cast}
                disabled={submitting || isPipelineLive || !prompt.trim()}
              >
                <Wand2 className="h-4 w-4" />
                {submitting
                  ? "speaking the words…"
                  : isPipelineLive
                    ? "the mirror is busy"
                    : "look in the mirror"}
              </Button>

              {error && (
                <Card compact className="border-tavern-blood/50 bg-tavern-blood/10">
                  <p className="flex items-start gap-2 text-sm text-tavern-blood">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </p>
                </Card>
              )}

              <Gallery
                items={gallery}
                loading={allPortraits === null}
                currentId={current?.id ?? null}
                onSetActive={setActive}
                onDelete={(p) => setConfirmDelete(p)}
              />
            </>
          ) : characters === null ? null : characters.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-7 w-7" />}
              title="No heroes yet"
              description="Roll one at the Fireplace first — the mirror needs a face to look for."
            />
          ) : (
            <EmptyState
              icon={<Sparkles className="h-7 w-7" />}
              title="Choose a hero"
              description="The mirror only paints faces it has been told to look for."
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await deletePortrait(confirmDelete.id);
        }}
        title="Banish this vision?"
        description="The portrait will be wiped from the mirror's gallery. This cannot be undone."
        confirmLabel="Banish"
        cancelLabel="Keep it"
      />
    </>
  );
}

// ---- Mirror frame ----
function MirrorFrame({
  submitting,
  portrait,
}: {
  submitting: boolean;
  portrait: PortraitDTO | null;
}) {
  return (
    <div className="breath relative mx-auto aspect-[3/4] w-full max-w-md rounded-[2.5rem] border-8 border-tavern-gold/40 bg-tavern-night/80 p-2 shadow-[0_0_40px_rgba(212,175,55,0.25)]">
      <div className="absolute inset-0 rounded-[2.5rem] border-2 border-tavern-gold/20" />
      <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-tavern-night via-[#1a1208] to-[#0a0604]">
        <AnimatePresence>
          {submitting && !portrait?.image_url && (
            <motion.div
              key="swirl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                className="h-2/3 w-2/3 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(240,160,80,0.4),transparent,rgba(212,175,55,0.5),transparent)] blur-2xl"
              />
              <Sparkles className="absolute h-10 w-10 text-tavern-gold/70 flicker" />
            </motion.div>
          )}
          {portrait?.image_url && (
            <motion.img
              key={portrait.id + portrait.image_url}
              src={portrait.image_url}
              alt="Generated portrait"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {!portrait && !submitting && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-tavern-parchment/40"
            >
              <Sparkles className="mb-3 h-8 w-8" />
              <p className="text-sm italic">
                Speak a vision into the mirror to see who looks back.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CharacterPicker({
  characters,
  chosen,
  onPick,
}: {
  characters: Character[] | null;
  chosen: Character | null;
  onPick: (c: Character | null) => void;
}) {
  return (
    <div>
      <Label>Whom do you bring to the mirror?</Label>
      {characters === null ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-full" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <p className="text-sm italic text-tavern-parchment/55">
          No heroes yet — roll one at the Fireplace.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {characters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className={`rounded-full border px-3 py-1 font-heading text-xs uppercase tracking-[0.2em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold ${
                chosen?.id === c.id
                  ? "border-tavern-gold bg-tavern-gold/20 text-tavern-gold"
                  : "border-tavern-stone/35 text-tavern-parchment/75 hover:border-tavern-gold/60 hover:text-tavern-parchment"
              }`}
            >
              {c.name || "Untitled"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Gallery({
  items,
  loading,
  currentId,
  onSetActive,
  onDelete,
}: {
  items: PortraitDTO[];
  loading: boolean;
  currentId: string | null;
  onSetActive: (id: string) => void;
  onDelete: (p: PortraitDTO) => void;
}) {
  if (loading) {
    return (
      <div>
        <Label className="text-tavern-parchment/55">Past visions</Label>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div>
      <Label className="text-tavern-parchment/55">Past visions</Label>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.slice(0, 24).map((p) => {
          const isActive = p.id === currentId;
          return (
            <div
              key={p.id}
              className={`group relative aspect-[3/4] overflow-hidden rounded border ${
                isActive
                  ? "border-tavern-gold shadow-[0_0_18px_rgba(212,175,55,0.5)]"
                  : "border-tavern-stone/40"
              }`}
            >
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.prompt}
                  title={p.prompt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-tavern-night/40 p-1 text-[0.6rem] italic text-tavern-stone">
                  {p.status === "failed" ? "vision lost" : "stirring…"}
                </div>
              )}

              {isActive && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-tavern-gold/90 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-tavern-night">
                  <Check className="h-3 w-3" />
                  active
                </span>
              )}

              {/* Action layer — visible on hover/focus */}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-tavern-night/95 via-tavern-night/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {!isActive && p.image_url ? (
                  <button
                    type="button"
                    onClick={() => onSetActive(p.id)}
                    aria-label="Set as active vision"
                    className="flex-1 rounded bg-tavern-night/70 px-1 py-0.5 text-[0.55rem] uppercase tracking-[0.15em] text-tavern-parchment hover:bg-tavern-night focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tavern-gold"
                  >
                    set active
                  </button>
                ) : (
                  <span className="flex-1" />
                )}
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  aria-label="Banish this vision"
                  className="rounded bg-tavern-night/70 p-1 text-tavern-parchment/80 hover:bg-tavern-blood/40 hover:text-tavern-parchment focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tavern-blood"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
