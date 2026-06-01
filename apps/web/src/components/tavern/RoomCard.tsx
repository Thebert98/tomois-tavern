"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@tomois/ui";
import { playSfx } from "@/lib/sfx";

export interface RoomCardProps {
  href: string;
  label: string;
  flavor: string;
  icon: ReactNode;
  /** Anchor color (defaults to tavern-fire). */
  accentClass?: string;
  className?: string;
}

/**
 * The mobile/tablet representation of a tavern hotspot. Reads like a
 * tavern signboard you click to enter that room.
 */
export function RoomCard({
  href,
  label,
  flavor,
  icon,
  accentClass = "text-tavern-fire",
  className,
}: RoomCardProps) {
  return (
    <Link
      href={href}
      onClick={() => void playSfx("door")}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-tavern-gold/25 bg-tavern-night/70 p-5 shadow-[0_18px_36px_-24px_rgba(0,0,0,0.8)] backdrop-blur transition-colors hover:border-tavern-gold/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-tavern-gold/30 bg-tavern-night/60 group-hover:flicker",
            accentClass,
          )}
        >
          {icon}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="font-heading text-sm uppercase tracking-[0.3em] text-tavern-parchment">
            {label}
          </div>
          <div className="mt-1 truncate text-xs italic text-tavern-parchment/60">
            {flavor}
          </div>
        </div>
        <span
          aria-hidden
          className="font-heading text-xs uppercase tracking-[0.3em] text-tavern-parchment/40 transition-colors group-hover:text-tavern-gold"
        >
          enter →
        </span>
      </div>
    </Link>
  );
}
