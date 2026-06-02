"use client";

import { useRouter } from "next/navigation";
import { Hotspot } from "./Hotspot";
import { RoomCard } from "./RoomCard";
import { Motes } from "./Motes";
import { ROOMS } from "./rooms";
import { playSfx } from "@/lib/sfx";

/**
 * The home of the tavern. Two layouts:
 *   - Mobile/tablet (<md): a vertical scroll of RoomCard signs.
 *   - Desktop (>=md): the immersive single-screen view, backed by the
 *     painted panorama at `/tavern/hearth.webp` (committed once via
 *     services/workshop/scripts/generate_tavern_art.py). Hotspot
 *     positions in rooms.ts are tuned to the painted props.
 */
export function Scene() {
  const router = useRouter();

  function enter(href: string) {
    void playSfx("door");
    router.push(href);
  }

  return (
    <main className="relative min-h-[100svh] w-full bg-tavern-night text-tavern-parchment">
      {/* ---- Mobile / tablet: stacked signboards ---- */}
      <section className="md:hidden">
        <header className="px-6 pb-2 pt-24 text-center">
          <h1 className="font-heading text-2xl uppercase tracking-[0.4em] text-tavern-gold">
            Tomoi&apos;s Tavern
          </h1>
          <p className="mt-2 text-xs italic text-tavern-parchment/60">
            Step in, traveller. The fire&apos;s warm.
          </p>
        </header>
        <ul className="space-y-3 px-6 py-6">
          {ROOMS.map((r) => (
            <li key={r.href}>
              <RoomCard
                href={r.href}
                label={r.label}
                flavor={r.flavor}
                icon={r.icon}
                accentClass={r.accentClass}
              />
            </li>
          ))}
        </ul>
        <footer className="pb-10 text-center text-[0.65rem] uppercase tracking-[0.4em] text-tavern-parchment/40">
          tap a sign to enter
        </footer>
      </section>

      {/* ---- Desktop: painted, immersive scene ---- */}
      <section className="vignette relative hidden h-[100svh] w-full overflow-hidden md:block">
        {/* The panorama itself */}
        <img
          src="/tavern/hearth.webp"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Soft candlelight wash layered over the painting — keeps the
            existing color story without overpowering the art. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(240,160,80,0.18),transparent_55%),radial-gradient(circle_at_25%_45%,rgba(212,175,55,0.08),transparent_45%)]" />

        {/* Bottom legibility gradient so hotspot tooltips remain readable
            against bright art near the foreground. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-tavern-night/85 via-tavern-night/35 to-transparent" />

        {/* Top legibility gradient for the credit line. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-tavern-night/70 to-transparent" />

        {/* Drifting dust motes */}
        <Motes />

        {/* Marquee */}
        <header className="absolute inset-x-0 top-16 z-10 text-center">
          <p className="font-heading text-[0.65rem] uppercase tracking-[0.5em] text-tavern-parchment/55">
            choose a place
          </p>
        </header>

        {/* Hotspots from the shared registry */}
        {ROOMS.map((r) => (
          <Hotspot
            key={r.href}
            x={r.x}
            y={r.y}
            size={r.size}
            label={r.label}
            description={r.flavor}
            icon={r.icon}
            accentClass={r.accentClass}
            onClick={() => enter(r.href)}
          />
        ))}

        <footer className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-between gap-2 px-6 text-[0.55rem] uppercase tracking-[0.3em] text-tavern-parchment/35">
          <span>click a place to enter</span>
          <span>panorama painted by fal.ai · flux pro</span>
        </footer>
      </section>
    </main>
  );
}
