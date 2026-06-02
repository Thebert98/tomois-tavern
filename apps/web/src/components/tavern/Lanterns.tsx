"use client";

/**
 * Lanterns — flickering radial-gradient glows anchored over the painted
 * lantern + candle positions in the panorama. Pure CSS; uses the shared
 * `.flicker` utility so reduced-motion already pauses them.
 *
 * Decorative, pointer-events-none, aria-hidden.
 */

interface Lamp {
  x: number;
  y: number;
  /** glow radius in vmin */
  radius: number;
  /** warmth: tavern-fire or tavern-candle */
  warmth: "fire" | "candle";
}

// Tuned to the committed hearth.webp.
const LAMPS: Lamp[] = [
  { x: 47, y: 12, radius: 10, warmth: "candle" }, // chandelier
  { x: 4, y: 28, radius: 5, warmth: "fire" }, // left wall sconce
  { x: 30, y: 25, radius: 5, warmth: "candle" }, // mantle candles, left
  { x: 53, y: 25, radius: 5, warmth: "candle" }, // mantle candles, right
  { x: 88, y: 25, radius: 5, warmth: "fire" }, // right wall sconce
];

export function Lanterns() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen"
    >
      {LAMPS.map((l, i) => {
        const color =
          l.warmth === "fire"
            ? "rgba(240,160,80,0.55)"
            : "rgba(245,209,138,0.55)";
        return (
          <span
            key={i}
            className="flicker absolute rounded-full"
            style={{
              left: `${l.x}%`,
              top: `${l.y}%`,
              width: `${l.radius * 2}vmin`,
              height: `${l.radius * 2}vmin`,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
              filter: "blur(2px)",
              animationDelay: `${i * 0.4}s`,
            }}
          />
        );
      })}
    </div>
  );
}
