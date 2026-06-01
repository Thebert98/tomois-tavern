"use client";

import { useRouter } from "next/navigation";
import { Flame, Sparkles, Music, ScrollText, Users } from "lucide-react";
import { Hotspot } from "./Hotspot";

/**
 * The Tavern scene — a single full-bleed interactive room.
 * Background is a CSS-art placeholder until we drop in a Flux-generated
 * panorama. Hotspots are anchored to % coords so they hold up at any size.
 */
export function Scene() {
  const router = useRouter();

  return (
    <main className="vignette relative h-[100svh] w-full overflow-hidden">
      {/* Background: layered candlelight gradients. Replace with a Flux panorama later. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(240,160,80,0.35),transparent_55%),radial-gradient(circle_at_25%_45%,rgba(212,175,55,0.12),transparent_45%),radial-gradient(circle_at_75%_45%,rgba(135,35,34,0.1),transparent_45%),linear-gradient(180deg,#0d0a08_0%,#1c120a_60%,#0a0604_100%)]" />

      {/* Faint floor planks */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-30"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0px, transparent 60px, rgba(59, 38, 26, 0.6) 60px, rgba(59, 38, 26, 0.6) 62px)",
        }}
      />

      {/* Top banner */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-6">
        <h1 className="font-heading text-2xl uppercase tracking-[0.4em] text-tavern-gold">
          Tomoi&apos;s Tavern
        </h1>
        <p className="hidden text-sm italic text-tavern-parchment/60 sm:block">
          Step in, traveller. The fire&apos;s warm.
        </p>
      </header>

      {/* Hotspots — five "places" inside the tavern */}
      <Hotspot
        x={50}
        y={68}
        size={16}
        label="Fireplace"
        description="Roll a new hero"
        icon={<Flame className="h-7 w-7" />}
        onClick={() => router.push("/fireplace")}
      />
      <Hotspot
        x={20}
        y={40}
        label="Magic Mirror"
        description="Portrait of your hero"
        icon={<Sparkles className="h-6 w-6" />}
        onClick={() => router.push("/mirror")}
      />
      <Hotspot
        x={80}
        y={40}
        label="Bard's Stage"
        description="A song of your deeds"
        icon={<Music className="h-6 w-6" />}
        onClick={() => router.push("/bard")}
      />
      <Hotspot
        x={28}
        y={78}
        label="Round Table"
        description="Your roster of heroes"
        icon={<Users className="h-6 w-6" />}
        onClick={() => router.push("/table")}
      />
      <Hotspot
        x={72}
        y={78}
        label="Notice Board"
        description="Friends & parties"
        icon={<ScrollText className="h-6 w-6" />}
        onClick={() => router.push("/board")}
      />

      {/* Bottom note */}
      <footer className="absolute inset-x-0 bottom-3 z-10 text-center text-[0.65rem] uppercase tracking-[0.4em] text-tavern-parchment/40">
        Click a place to enter
      </footer>
    </main>
  );
}
