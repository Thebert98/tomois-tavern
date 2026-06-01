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
 *   - Desktop (>=md): the immersive single-screen hotspot scene.
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

      {/* ---- Desktop: immersive scene ---- */}
      <section className="vignette relative hidden h-[100svh] w-full overflow-hidden md:block">
        {/* Layered candlelight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(240,160,80,0.35),transparent_55%),radial-gradient(circle_at_25%_45%,rgba(212,175,55,0.12),transparent_45%),radial-gradient(circle_at_75%_45%,rgba(135,35,34,0.1),transparent_45%),linear-gradient(180deg,#0d0a08_0%,#1c120a_60%,#0a0604_100%)]" />

        {/* Faint floor planks */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-30"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent 0px, transparent 60px, rgba(59, 38, 26, 0.6) 60px, rgba(59, 38, 26, 0.6) 62px)",
          }}
        />

        {/* Drifting dust motes */}
        <Motes />

        {/* Marquee */}
        <header className="absolute inset-x-0 top-16 z-10 text-center">
          <p className="font-heading text-[0.65rem] uppercase tracking-[0.5em] text-tavern-parchment/45">
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

        <footer className="absolute inset-x-0 bottom-3 z-10 text-center text-[0.65rem] uppercase tracking-[0.4em] text-tavern-parchment/40">
          click a place to enter
        </footer>
      </section>
    </main>
  );
}
