"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertTriangle, Wand2 } from "lucide-react";
import { reroll, workshop } from "@/lib/api";

interface Character {
  id: string;
  name: string;
  sheet: Record<string, unknown>;
}

interface Portrait {
  id: string;
  character_id: string | null;
  image_url: string | null;
  prompt: string;
  status: string;
  created_at: string;
}

function characterFlavor(sheet: Record<string, unknown>): string {
  // Compose a short trait string from the sheet to seed a good prompt.
  const pick = (key: string) => {
    const f = sheet[key] as { value?: unknown } | undefined;
    return typeof f?.value === "string" ? f.value : "";
  };
  const parts = [
    pick("race"),
    pick("char_class"),
    pick("background"),
    pick("alignment"),
  ].filter(Boolean);
  return parts.join(", ");
}

export function MirrorRoom() {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [chosen, setChosen] = useState<Character | null>(null);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [latest, setLatest] = useState<Portrait | null>(null);
  const [gallery, setGallery] = useState<Portrait[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initial load: parallel fetch characters + gallery.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      reroll.listCharacters().catch(() => [] as Character[]),
      workshop.listPortraits().catch(() => [] as Portrait[]),
    ]).then(([chars, portraits]) => {
      if (cancelled) return;
      setCharacters(chars);
      setGallery(portraits);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-seed the prompt when a character is picked.
  useEffect(() => {
    if (!chosen) return;
    const flavor = characterFlavor(chosen.sheet);
    setPrompt(
      `Portrait of ${chosen.name}${flavor ? `, ${flavor}` : ""}. ` +
        "Painterly fantasy oil-painting style, warm tavern lighting, " +
        "dramatic shadows, head-and-shoulders composition.",
    );
  }, [chosen]);

  async function cast() {
    setSubmitting(true);
    setError(null);
    setLatest(null);
    try {
      const result = await workshop.createPortrait({
        character_id: chosen?.id ?? null,
        prompt,
      });
      const portrait: Portrait = {
        id: result.id,
        image_url: result.image_url,
        status: result.status,
        prompt: result.prompt,
        character_id: chosen?.id ?? null,
        created_at: new Date().toISOString(),
      };
      setLatest(portrait);
      setGallery((g) => [portrait, ...g]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      {/* The mirror itself */}
      <section>
        <MirrorFrame submitting={submitting} portrait={latest} />
      </section>

      {/* Controls + gallery */}
      <section className="flex flex-col gap-6">
        <CharacterPicker
          characters={characters}
          chosen={chosen}
          onPick={setChosen}
        />
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
          disabled={submitting || !prompt.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-tavern-ember px-4 py-3 font-heading uppercase tracking-[0.25em] text-tavern-night shadow-lg transition-colors hover:bg-tavern-fire disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          {submitting ? "the mirror swirls…" : "look in the mirror"}
        </button>

        {error && (
          <p className="flex items-start gap-2 rounded border border-tavern-blood/50 bg-tavern-blood/10 p-3 text-sm text-tavern-blood">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <Gallery items={gallery} />
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
  portrait: Portrait | null;
}) {
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-md rounded-[2.5rem] border-8 border-tavern-gold/40 bg-tavern-night/80 p-2 shadow-[0_0_40px_rgba(212,175,55,0.25)]">
      <div className="absolute inset-0 rounded-[2.5rem] border-2 border-tavern-gold/20" />
      <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-tavern-night via-[#1a1208] to-[#0a0604]">
        <AnimatePresence>
          {submitting && (
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
          {portrait?.image_url && !submitting && (
            <motion.img
              key={portrait.id}
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

// ---- Character picker ----
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
          No heroes yet — roll one at the Fireplace first, or describe one
          freely below.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPick(null)}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${
              chosen === null
                ? "border-tavern-gold bg-tavern-gold/20 text-tavern-gold"
                : "border-tavern-stone/30 text-tavern-parchment/70 hover:border-tavern-gold/60"
            }`}
          >
            no one
          </button>
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

// ---- Gallery ----
function Gallery({ items }: { items: Portrait[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 font-heading text-xs uppercase tracking-[0.3em] text-tavern-parchment/60">
        Past visions
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.slice(0, 12).map((p) =>
          p.image_url ? (
            <a
              key={p.id}
              href={p.image_url}
              target="_blank"
              rel="noreferrer"
              className="group relative aspect-square overflow-hidden rounded border border-tavern-stone/40"
              title={p.prompt}
            >
              <img
                src={p.image_url}
                alt={p.prompt}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </a>
          ) : (
            <div
              key={p.id}
              className="aspect-square rounded border border-dashed border-tavern-stone/40 bg-tavern-night/40 p-2 text-[0.6rem] italic text-tavern-stone"
            >
              {p.status === "failed" ? "vision lost" : "the mirror stirs…"}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
