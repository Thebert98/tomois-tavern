"use client";

import { useMemo } from "react";

/**
 * Floating dust motes drifting upward across the scene. Pure CSS — uses
 * the `mote` keyframe from globals.css. Disabled by reduced-motion.
 */
export function Motes({ count = 14 }: { count?: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 18,
        duration: 14 + Math.random() * 16,
        size: 1.5 + Math.random() * 2.5,
        opacity: 0.35 + Math.random() * 0.35,
      })),
    [count],
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {motes.map((m) => (
        <span
          key={m.id}
          className="absolute bottom-0 rounded-full bg-tavern-candle"
          style={{
            left: `${m.left}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            opacity: m.opacity,
            animation: `mote ${m.duration}s linear ${m.delay}s infinite`,
            filter: "blur(0.5px)",
          }}
        />
      ))}
    </div>
  );
}
