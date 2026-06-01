"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tavern ambient + SFX. Audio is off by default and the user controls it
 * via the TavernHUD mute toggle (persisted in localStorage).
 *
 * If the audio files don't exist (the common case until we ship assets),
 * Howler swallows the load error and the hook becomes a no-op — the UI
 * never breaks. See docs/DESIGN.md §5.
 */
const MUTE_KEY = "tavern.audio.muted";
const AMBIENT_VOL = 0.32;

const AMBIENT_SRC = "/audio/ambient.mp3";

interface HowlerLike {
  Howl: new (opts: HowlOpts) => HowlInstance;
}

interface HowlOpts {
  src: string[];
  volume?: number;
  loop?: boolean;
  html5?: boolean;
  onloaderror?: () => void;
}

interface HowlInstance {
  play(): number;
  pause(): void;
  stop(): void;
  fade(from: number, to: number, durationMs: number): void;
  volume(v?: number): number;
}

let howlerPromise: Promise<HowlerLike | null> | null = null;
async function loadHowler(): Promise<HowlerLike | null> {
  if (typeof window === "undefined") return null;
  howlerPromise ??= import("howler")
    .then((mod) => mod as unknown as HowlerLike)
    .catch(() => null);
  return howlerPromise;
}

export function useAmbient() {
  const [muted, setMuted] = useState(true); // default off
  const ambient = useRef<HowlInstance | null>(null);

  // Restore preference.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUTE_KEY);
      if (stored === "false") setMuted(false);
    } catch {
      // ignore (e.g. SSR / privacy mode)
    }
  }, []);

  // Persist.
  useEffect(() => {
    try {
      window.localStorage.setItem(MUTE_KEY, String(muted));
    } catch {
      // ignore
    }
  }, [muted]);

  // Bring the ambient loop in/out when muted state changes.
  useEffect(() => {
    let cancelled = false;
    if (muted) {
      ambient.current?.pause();
      return;
    }
    (async () => {
      const lib = await loadHowler();
      if (cancelled || !lib) return;
      if (!ambient.current) {
        ambient.current = new lib.Howl({
          src: [AMBIENT_SRC],
          volume: 0,
          loop: true,
          html5: true,
          onloaderror: () => {
            ambient.current = null;
          },
        });
      }
      try {
        ambient.current?.play();
        ambient.current?.fade(0, AMBIENT_VOL, 800);
      } catch {
        // ignore — autoplay policies vary by browser
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [muted]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      ambient.current?.stop();
      ambient.current = null;
    };
  }, []);

  const toggle = useCallback(() => setMuted((m) => !m), []);
  return { muted, toggle };
}
