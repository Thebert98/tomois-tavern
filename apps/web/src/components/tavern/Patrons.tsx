"use client";

import { CSSProperties, ReactNode } from "react";

/**
 * Patrons — absolutely-positioned silhouettes of seated/standing folk
 * over the painted tavern panorama. Each is a small inline SVG with the
 * shared `.breath` utility (so reduced-motion already applies) plus a
 * tiny per-element sway via CSS variables.
 *
 * Decorative only: `pointer-events-none`, `aria-hidden`.
 */

interface Patron {
  /** % position on the panorama */
  x: number;
  y: number;
  /** size in vmin */
  size: number;
  /** sway distance in pixels (horizontal) */
  sway: number;
  /** sway period in seconds */
  period: number;
  /** silhouette glyph */
  shape: "seated" | "standing" | "leaning";
}

// Tuned to the committed hearth.webp. If the panorama is regenerated, walk
// the new image and update these so silhouettes don't float into props.
const PATRONS: Patron[] = [
  // At the round oak table, front-left foreground
  { x: 9, y: 76, size: 11, sway: 5, period: 7, shape: "seated" },
  // At a small table beside the hearth
  { x: 34, y: 73, size: 10, sway: 4, period: 8, shape: "seated" },
  // Leaning by the stage, listening to the bard
  { x: 76, y: 62, size: 13, sway: 6, period: 9, shape: "leaning" },
];

function PatronGlyph({ shape }: { shape: Patron["shape"] }) {
  // Crude silhouettes — head + shoulders / torso. Real characters are
  // painted in the panorama; these are background-fillers that move.
  switch (shape) {
    case "seated":
      return (
        <svg viewBox="0 0 40 60" preserveAspectRatio="xMidYMax meet" className="h-full w-full">
          {/* head */}
          <ellipse cx="20" cy="14" rx="7" ry="8" />
          {/* shoulders */}
          <path d="M6 30 Q20 22 34 30 L34 60 L6 60 Z" />
        </svg>
      );
    case "standing":
      return (
        <svg viewBox="0 0 40 60" preserveAspectRatio="xMidYMax meet" className="h-full w-full">
          <ellipse cx="20" cy="10" rx="6" ry="7" />
          <path d="M10 22 Q20 18 30 22 L26 36 L30 60 L10 60 L14 36 Z" />
        </svg>
      );
    case "leaning":
      return (
        <svg viewBox="0 0 40 60" preserveAspectRatio="xMidYMax meet" className="h-full w-full">
          <ellipse cx="22" cy="11" rx="6" ry="7" />
          <path d="M8 26 Q22 20 32 28 L26 40 L34 60 L14 60 L16 40 Z" />
        </svg>
      );
  }
}

export function Patrons(): ReactNode {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {PATRONS.map((p, i) => {
        const style: CSSProperties = {
          left: `${p.x}%`,
          top: `${p.y}%`,
          width: `${p.size}vmin`,
          height: `${p.size * 1.4}vmin`,
          // The sway is composed with the .breath scale by Framer's
          // compositing: we wrap in two containers so each lives on its
          // own transform. The outer one sways; the inner one breathes.
          animation: `patron-sway-${i} ${p.period}s ease-in-out infinite`,
          animationDelay: `${i * 0.7}s`,
          // CSS vars for the keyframes below
          ["--sway" as string]: `${p.sway}px`,
        };
        return (
          <span
            key={i}
            style={style}
            className="absolute -translate-x-1/2 -translate-y-full text-tavern-night/85"
          >
            <span className="breath block h-full w-full" style={{ filter: "blur(0.4px)" }}>
              <PatronGlyph shape={p.shape} />
            </span>
          </span>
        );
      })}

      {/* Per-patron sway keyframes. Three patrons → three keyframes so
          they're slightly out of phase. */}
      <style>{`
        @keyframes patron-sway-0 { 0%,100% { transform: translate(calc(-50% - var(--sway)), -100%); } 50% { transform: translate(calc(-50% + var(--sway)), -100%); } }
        @keyframes patron-sway-1 { 0%,100% { transform: translate(calc(-50% + var(--sway)), -100%); } 50% { transform: translate(calc(-50% - var(--sway)), -100%); } }
        @keyframes patron-sway-2 { 0%,100% { transform: translate(calc(-50% - var(--sway)), -100%); } 50% { transform: translate(calc(-50% + var(--sway)), -100%); } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes patron-sway-0 { 0%,100% { transform: translate(-50%, -100%); } }
          @keyframes patron-sway-1 { 0%,100% { transform: translate(-50%, -100%); } }
          @keyframes patron-sway-2 { 0%,100% { transform: translate(-50%, -100%); } }
        }
      `}</style>
    </div>
  );
}
