"use client";

import { useEffect, useState } from "react";
import { cn } from "@tomois/ui";

interface SpriteAnimProps {
  /** Array of frame URLs (cycled in order). If null/empty, falls back to `still`. */
  frames: string[] | null | undefined;
  /** Single still sprite to show when frames are absent or animation is paused. */
  still: string | null | undefined;
  /** Animation behavior. */
  mode?: "always" | "on-hover";
  /** ms between frames. */
  intervalMs?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders an animated pixel sprite. When `mode="on-hover"` it shows the still
 * sprite until hovered, then cycles through frames (FF-style idle).
 * Gracefully falls back to the still image when no frames are available.
 */
export function SpriteAnim({
  frames,
  still,
  mode = "on-hover",
  intervalMs = 220,
  className,
  alt = "sprite",
}: SpriteAnimProps) {
  const hasFrames = !!frames && frames.length > 1;
  const [hover, setHover] = useState(false);
  const [idx, setIdx] = useState(0);

  const active = mode === "always" || hover;

  useEffect(() => {
    if (!hasFrames || !active) {
      setIdx(0);
      return;
    }
    const t = setInterval(
      () => setIdx((i) => (i + 1) % frames!.length),
      intervalMs,
    );
    return () => clearInterval(t);
  }, [hasFrames, active, frames, intervalMs]);

  const src = hasFrames && active ? frames![idx] : still;
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn("select-none", className)}
      style={{ imageRendering: "pixelated" }}
      draggable={false}
    />
  );
}
