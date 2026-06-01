"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertTriangle, Wand2, Check } from "lucide-react";
import { reroll, workshop, type PortraitDTO } from "@/lib/api";
import { PortraitProgress } from "@/components/PortraitProgress";
import { supabaseBrowser } from "@/lib/supabase/client";

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
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [chosen, setChosen] = useState<Character | null>(null);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inFlight, setInFlight] = useState<PortraitDTO | null>(null);
  const [allPortraits, setAllPortraits] = useState<PortraitDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  // Subscribe to row updates for the in-flight portrait.
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
            const exists = list.some((p) => p.id === next.id);
            return exists
              ? list.map((p) => (p.id === next.id ? next : p))
              : [next, ...list];
          });
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [inFlight?.id]);

  const gallery = useMemo(
    () => (chosen ? allPortraits.filter((p) => p.character_id === chosen.id) : []),
    [allPortraits, chosen],
  );
  const current = useMemo(
    () => gallery.find((p) => p.is_current) ?? null,
    [gallery],
  );

  // Once the pipeline is live, always show the in-flight portrait — even
  // after it hits "ready", until the user generates a new one or picks an
  // active portrait from the gallery. Otherwise the mirror goes blank the
  // moment the row finishes.
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
      setAllPortraits((g) => [portrait, ...g]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function setActive(id: string) {
    try {
      const updated = await workshop.setCurrentPortrait(id);
      setAllPortraits((list) =>
        list.map((p) =>
          p.character_id === updated.character_id
            ? { ...p, is_current: p.id === id }
            : p,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
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
              <label className="mb-2 block font-heading text-xs uppercase tracking-[0.3em] text-tavern-gold">
                What does the mirror reveal?
              </label>
              <textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded-lg border border-tavern-stone/40 bg-tavern-night/80 px-3 py-2 text-sm leading-relaxed text-tavern-parchment outline-none placeholder:text-tavern-stone focus:border-tavern-gold"
                placeholder="A weather-beaten half-elven ranger with silver braids…"
              />
            </div>

            <button
              type="button"
              onClick={cast}
              disabled={submitting || isPipelineLive || !prompt.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-tavern-ember px-4 py-3 font-heading uppercase tracking-[0.25em] text-tavern-night shadow-lg transition-colors hover:bg-tavern-fire disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {submitting
                ? "speaking the words…"
                : isPipelineLive
                  ? "the mirror is busy"
                  : "look in the mirror"}
            </button>

            {error && (
              <p className="flex items-start gap-2 rounded border border-tavern-blood/50 bg-tavern-blood/10 p-3 text-sm text-tavern-blood">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <Gallery
              items={gallery}
              currentId={current?.id ?? null}
              onSetActive={setActive}
            />
          </>
        ) : (
          <p className="rounded border border-dashed border-tavern-stone/40 bg-tavern-night/40 p-4 text-sm italic text-tavern-parchment/60">
            Choose a hero above. The mirror only paints faces it has been told
            to look for.
          </p>
        )}
      </section>
    </div>
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
    <div className="relative mx-auto aspect-[3/4] w-full max-w-md rounded-[2.5rem] border-8 border-tavern-gold/40 bg-tavern-night/80 p-2 shadow-[0_0_40px_rgba(212,175,55,0.25)]">
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
      <label className="mb-2 block font-heading text-xs uppercase tracking-[0.3em] text-tavern-gold">
        Whom do you bring to the mirror?
      </label>
      {characters === null ? (
        <p className="text-sm italic text-tavern-parchment/50">
          Stirring the embers, fetching your heroes…
        </p>
      ) : characters.length === 0 ? (
        <p className="text-sm italic text-tavern-parchment/60">
          No heroes yet — roll one at the Fireplace first.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {characters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                chosen?.id === c.id
                  ? "border-tavern-gold bg-tavern-gold/20 text-tavern-gold"
                  : "border-tavern-stone/30 text-tavern-parchment/70 hover:border-tavern-gold/60"
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
  currentId,
  onSetActive,
}: {
  items: PortraitDTO[];
  currentId: string | null;
  onSetActive: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 font-heading text-xs uppercase tracking-[0.3em] text-tavern-parchment/60">
        Past visions
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.slice(0, 12).map((p) => {
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
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-tavern-night/40 p-1 text-[0.6rem] italic text-tavern-stone">
                  {p.status === "failed" ? "vision lost" : "stirring…"}
                </div>
              )}
              {isActive ? (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-tavern-gold/90 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-tavern-night">
                  <Check className="h-3 w-3" />
                  active
                </span>
              ) : p.image_url ? (
                <button
                  type="button"
                  onClick={() => onSetActive(p.id)}
                  className="absolute inset-x-0 bottom-0 bg-tavern-night/80 py-1 text-[0.55rem] uppercase tracking-[0.18em] text-tavern-parchment opacity-0 transition-opacity hover:bg-tavern-night group-hover:opacity-100"
                >
                  set as active
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
