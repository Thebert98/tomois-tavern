"use client";

/**
 * Lightweight SFX dispatcher. Calls into Howler if it's loaded and audio
 * is enabled; quietly no-ops when audio files are missing or muted (the
 * `MUTE_KEY` set by useAmbient gates playback so respect the same flag).
 *
 * Usage:
 *   playSfx('embers');
 *
 * Files live in apps/web/public/audio/{name}.mp3 — when they don't exist
 * yet, the call is harmless. See docs/DESIGN.md §5 for the SFX registry.
 */
const MUTE_KEY = "tavern.audio.muted";

type SfxName = "embers" | "mug" | "door" | "scroll" | "chime";

const registry: Record<SfxName, { src: string; volume: number }> = {
  embers: { src: "/audio/embers.mp3", volume: 0.6 },
  mug: { src: "/audio/mug.mp3", volume: 0.55 },
  door: { src: "/audio/door.mp3", volume: 0.6 },
  scroll: { src: "/audio/scroll-unfurl.mp3", volume: 0.5 },
  chime: { src: "/audio/chime.mp3", volume: 0.5 },
};

interface HowlInstance {
  play(): number;
  volume(v?: number): number;
}
interface HowlerLib {
  Howl: new (opts: {
    src: string[];
    volume?: number;
    html5?: boolean;
    preload?: boolean;
    onloaderror?: () => void;
  }) => HowlInstance;
}

const cache = new Map<SfxName, HowlInstance | null>();
let lib: HowlerLib | null = null;

async function ensureLib(): Promise<HowlerLib | null> {
  if (lib) return lib;
  try {
    lib = (await import("howler")) as unknown as HowlerLib;
    return lib;
  } catch {
    return null;
  }
}

export async function playSfx(name: SfxName): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(MUTE_KEY) !== "false") return;
  } catch {
    return;
  }
  const lib = await ensureLib();
  if (!lib) return;
  let inst = cache.get(name);
  if (inst === undefined) {
    const entry = registry[name];
    inst = new lib.Howl({
      src: [entry.src],
      volume: entry.volume,
      html5: true,
      preload: true,
      onloaderror: () => {
        cache.set(name, null);
      },
    });
    cache.set(name, inst);
  }
  if (!inst) return;
  try {
    inst.play();
  } catch {
    // ignore
  }
}
