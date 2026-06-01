"use client";

import { motion } from "framer-motion";
import { cn } from "@tomois/ui";
import { ReactNode } from "react";

export interface HotspotProps {
  label: string;
  description: string;
  icon: ReactNode;
  /** % positions inside the scene */
  x: number;
  y: number;
  /** rough hit-area size in vmin */
  size?: number;
  onClick?: () => void;
}

export function Hotspot({
  label,
  description,
  icon,
  x,
  y,
  size = 14,
  onClick,
}: HotspotProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "group absolute -translate-x-1/2 -translate-y-1/2",
        "flex flex-col items-center justify-center gap-2 rounded-2xl",
        "border border-tavern-gold/30 bg-tavern-night/40 px-3 py-2 backdrop-blur-sm",
        "transition-colors hover:border-tavern-gold/80 hover:bg-tavern-night/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold",
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}vmin`,
        height: `${size}vmin`,
      }}
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.96 }}
      aria-label={`${label} — ${description}`}
    >
      <div className="text-tavern-fire group-hover:flicker">{icon}</div>
      <span className="font-heading text-xs uppercase tracking-[0.2em] text-tavern-parchment">
        {label}
      </span>
      <span className="hidden text-center text-[0.65rem] leading-tight text-tavern-parchment/70 group-hover:block">
        {description}
      </span>
    </motion.button>
  );
}
