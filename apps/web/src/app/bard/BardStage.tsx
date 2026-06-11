"use client";

import { useEffect, useMemo, useState } from "react";
import { Music, Sparkles, AlertTriangle, Disc3, BookOpen, Plus } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
  useToast,
} from "@tomois/ui";
import {
  workshop,
  reroll,
  parties,
  lore as loreApi,
  type SongDTO,
  type RerollCharacter,
  type PartyDTO,
  type LoreDTO,
} from "@/lib/api";

type Scope = "feat" | "party" | "lore";

const SCOPES: { key: Scope; label: string; flavor: string }[] = [
  {
    key: "feat",
    label: "A hero's feat",
    flavor: "Sing of one character's deeds.",
  },
  {
    key: "party",
    label: "The party's tale",
    flavor: "A ballad for the whole table.",
  },
  {
    key: "lore",
    label: "World lore",
    flavor: "Song of the land — pick a page from your book.",
  },
];

export function BardStage() {
  const { toast } = useToast();
  const [scope, setScope] = useState<Scope>("feat");
  const [sourceId, setSourceId] = useState<string>("");
  const [genre, setGenre] = useState("medieval tavern folk");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [latest, setLatest] = useState<SongDTO | null>(null);
  const [library, setLibrary] = useState<SongDTO[] | null>(null);
  const [characters, setCharacters] = useState<RerollCharacter[]>([]);
  const [userParties, setUserParties] = useState<PartyDTO[]>([]);
  const [loreEntries, setLoreEntries] = useState<LoreDTO[]>([]);
  const [newLoreTitle, setNewLoreTitle] = useState("");
  const [newLoreBody, setNewLoreBody] = useState("");
  const [forging, setForging] = useState(false);

  useEffect(() => {
    void Promise.all([
      reroll.listCharacters().catch(() => [] as RerollCharacter[]),
      parties.list().catch(() => [] as PartyDTO[]),
      workshop.listSongs().catch(() => [] as SongDTO[]),
      loreApi.list().catch(() => [] as LoreDTO[]),
    ]).then(([cs, ps, songs, lor]) => {
      setCharacters(cs);
      setUserParties(ps);
      setLibrary(songs);
      setLoreEntries(lor);
    });
  }, []);

  // Reset source when scope changes.
  useEffect(() => {
    setSourceId("");
  }, [scope]);

  const sources = useMemo(() => {
    if (scope === "feat") {
      return characters.map((c) => ({ id: c.id, label: c.name || "Untitled" }));
    }
    if (scope === "party") {
      return userParties.map((p) => ({ id: p.id, label: p.name }));
    }
    if (scope === "lore") {
      return loreEntries.map((l) => ({ id: l.id, label: l.title }));
    }
    return [];
  }, [scope, characters, userParties, loreEntries]);

  async function forgeLore() {
    const title = newLoreTitle.trim();
    const body = newLoreBody.trim();
    if (!title || !body) {
      toast("A title and a few lines, traveller.", { tone: "error" });
      return;
    }
    setForging(true);
    try {
      const created = await loreApi.create({ title, body });
      setLoreEntries((cur) => [created, ...cur]);
      setSourceId(created.id);
      setNewLoreTitle("");
      setNewLoreBody("");
      toast("Inked into the book.", { tone: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The ink ran.";
      toast(msg.replace(/^\d+:\s*/, ""), { tone: "error" });
    } finally {
      setForging(false);
    }
  }

  async function sing() {
    if (!sourceId) {
      const what =
        scope === "feat" ? "hero" : scope === "party" ? "party" : "lore entry";
      toast(`Pick a ${what} first.`, { tone: "error" });
      return;
    }
    if (!prompt.trim()) {
      toast("Whisper a few words for the bard to spin.", { tone: "error" });
      return;
    }
    setSubmitting(true);
    setLatest(null);
    try {
      const song = await workshop.createSong({
        scope,
        source_id: sourceId,
        prompt: prompt.trim(),
        genre: genre.trim() || "medieval tavern folk",
      });
      setLatest(song);
      setLibrary((list) => [song, ...(list ?? [])]);
      toast("The bard finishes — listen close.", { tone: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The bard tires.";
      const friendlier = msg.includes("SUNO")
        ? "The bard's lute is unstrung (no Suno key set)."
        : msg.replace(/^\d+:\s*/, "");
      toast(friendlier, { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      {/* ---- Compose panel ---- */}
      <section className="space-y-5">
        <div>
          <Label>What shall the bard sing of?</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCOPES.map((s) => {
              const active = scope === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScope(s.key)}
                  className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold ${
                    active
                      ? "border-tavern-ale bg-tavern-ale/15 text-tavern-parchment"
                      : "border-tavern-stone/30 bg-tavern-night/50 text-tavern-parchment/80 hover:border-tavern-ale/60"
                  }`}
                  aria-pressed={active}
                >
                  <div className="font-heading text-xs uppercase tracking-[0.25em]">
                    {s.label}
                  </div>
                  <div className="mt-1 text-[0.65rem] italic text-tavern-parchment/60">
                    {s.flavor}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="bard-source">
            {scope === "feat"
              ? "Which hero?"
              : scope === "party"
                ? "Which party?"
                : "Which lore?"}
          </Label>
          {sources.length === 0 ? (
            <p className="text-xs italic text-tavern-parchment/55">
              {scope === "feat"
                ? "No heroes yet — seat one at the Round Table."
                : scope === "party"
                  ? "No parties yet — found one at the Notice Board."
                  : "No lore inked yet — forge a first piece below."}
            </p>
          ) : (
            <select
              id="bard-source"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full rounded-lg border border-tavern-stone/35 bg-tavern-night px-3 py-2 text-sm text-tavern-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
            >
              <option value="">choose one…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {scope === "lore" && (
          <Card compact className="border-tavern-stone/30">
            <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.25em] text-tavern-parchment/70">
              <BookOpen className="h-3.5 w-3.5 text-tavern-ale" />
              Forge a new piece of lore
            </div>
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Title — e.g. The Burned Harbor"
                value={newLoreTitle}
                onChange={(e) => setNewLoreTitle(e.target.value)}
                aria-label="Lore title"
              />
              <Textarea
                rows={3}
                placeholder="A few lines about the place, the legend, or the night it all went wrong."
                value={newLoreBody}
                onChange={(e) => setNewLoreBody(e.target.value)}
                aria-label="Lore body"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={forgeLore}
                disabled={forging || !newLoreTitle.trim() || !newLoreBody.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                {forging ? "inking…" : "ink it"}
              </Button>
            </div>
          </Card>
        )}

        <div>
          <Label htmlFor="bard-genre">Genre or style</Label>
          <Input
            id="bard-genre"
            placeholder="medieval tavern folk, slow ballad"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="bard-prompt">Whisper to the bard</Label>
          <Textarea
            id="bard-prompt"
            rows={4}
            placeholder="A triumphant ballad about defeating the lich-king of Ash Hollow."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <Button
          size="lg"
          onClick={sing}
          disabled={submitting || !sourceId || !prompt.trim()}
        >
          <Music className="h-4 w-4" />
          {submitting ? "the bard tunes…" : "sing the song"}
        </Button>

        <Card compact className="border-tavern-stone/30">
          <p className="flex items-start gap-2 text-xs italic text-tavern-parchment/55">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-tavern-gold" />
            The bard takes a minute or two to compose — Claude writes the
            lyrics, then Suno performs them.
          </p>
        </Card>
      </section>

      {/* ---- Listening panel ---- */}
      <section className="space-y-6">
        <PreviewPanel song={latest} submitting={submitting} />

        <div>
          <h3 className="mb-3 font-heading text-xs uppercase tracking-[0.3em] text-tavern-parchment/60">
            Past songs
          </h3>
          {library === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : library.length === 0 ? (
            <EmptyState
              icon={<Disc3 className="h-7 w-7" />}
              title="The library is quiet"
              description="Sing one and it'll join the shelf."
            />
          ) : (
            <ul className="space-y-3">
              {library.slice(0, 12).map((s) => (
                <SongRow
                  key={s.id}
                  song={s}
                  isActive={latest?.id === s.id}
                  onSelect={() => setLatest(s)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function PreviewPanel({
  song,
  submitting,
}: {
  song: SongDTO | null;
  submitting: boolean;
}) {
  if (submitting && !song) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-sm italic text-tavern-parchment/70">
          <Disc3 className="h-5 w-5 animate-spin text-tavern-ale" />
          The bard hums to herself, then begins…
        </div>
      </Card>
    );
  }
  if (!song) {
    return (
      <Card>
        <p className="text-sm italic text-tavern-parchment/55">
          Speak a wish to the bard and a song will land here.
        </p>
      </Card>
    );
  }
  if (song.status === "failed") {
    return (
      <Card className="border-tavern-blood/50 bg-tavern-blood/10">
        <div className="flex items-start gap-2 text-sm text-tavern-blood">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          The bard&apos;s lute slipped — try once more.
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Chip tone="active">
          <Music className="h-3 w-3" />
          {song.scope}
        </Chip>
        {song.duration_s && (
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-tavern-parchment/55">
            {song.duration_s}s
          </span>
        )}
      </div>
      {song.audio_url ? (
        <audio
          controls
          src={song.audio_url}
          className="w-full"
          preload="metadata"
        >
          Your browser does not play sound.
        </audio>
      ) : (
        <p className="text-xs italic text-tavern-parchment/55">
          (no audio yet)
        </p>
      )}
      {song.lyrics && (
        <pre className="scroll-tavern mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-tavern-stone/30 bg-tavern-night/60 p-3 font-body text-xs leading-relaxed text-tavern-parchment/90">
          {song.lyrics}
        </pre>
      )}
    </Card>
  );
}

function songStatusChip(status: string): {
  tone: "active" | "muted" | "default";
  label: string;
} {
  if (status === "ready") return { tone: "active", label: "ready" };
  if (status === "failed") return { tone: "muted", label: "lost to silence" };
  return { tone: "muted", label: "still singing…" };
}

function SongRow({
  song,
  isActive,
  onSelect,
}: {
  song: SongDTO;
  isActive?: boolean;
  onSelect?: () => void;
}) {
  const statusChip = songStatusChip(song.status);
  const selectable = !!onSelect;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={!selectable}
        aria-pressed={isActive ?? undefined}
        className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold ${
          isActive
            ? "border-tavern-ale bg-tavern-ale/15"
            : "border-tavern-stone/30 bg-tavern-night/50 hover:border-tavern-ale/60"
        } ${selectable ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Chip tone="default">{song.scope}</Chip>
            <Chip tone={statusChip.tone}>{statusChip.label}</Chip>
            <span className="truncate text-sm text-tavern-parchment/80">
              {song.prompt}
            </span>
          </div>
          <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.2em] text-tavern-parchment/55">
            {new Date(song.created_at).toLocaleDateString()}
          </span>
        </div>
        {song.audio_url && (
          <audio
            controls
            src={song.audio_url}
            className="mt-2 w-full"
            preload="none"
            // Don't bubble play/pause clicks into the row's onSelect.
            onClick={(e) => e.stopPropagation()}
          >
            Your browser does not play sound.
          </audio>
        )}
      </button>
    </li>
  );
}
