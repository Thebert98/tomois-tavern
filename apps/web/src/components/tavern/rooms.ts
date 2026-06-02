import { Flame, Sparkles, Music, ScrollText, Users } from "lucide-react";
import { createElement, ReactNode } from "react";

export interface RoomDescriptor {
  href: string;
  label: string;
  flavor: string;
  icon: ReactNode;
  /** % position on the immersive desktop scene (x, y) */
  x: number;
  y: number;
  /** size in vmin for the immersive scene */
  size?: number;
  /** anchor color for the icon */
  accentClass: string;
}

/**
 * Single source of truth for the five tavern places.
 *
 * Desktop `x` / `y` are percentages aligned to the painted props in
 * `/apps/web/public/tavern/hearth.webp`. If the panorama is regenerated,
 * re-tune these so the hotspots still land on the hearth / mirror / stage /
 * round table / scrolls in the image.
 */
export const ROOMS: RoomDescriptor[] = [
  {
    href: "/fireplace",
    label: "Fireplace",
    flavor: "Stoke the embers — roll a hero.",
    icon: createElement(Flame, { className: "h-7 w-7" }),
    x: 42, // painted hearth, dead center, just below mid-height
    y: 58,
    size: 16,
    accentClass: "text-tavern-fire",
  },
  {
    href: "/mirror",
    label: "Magic Mirror",
    flavor: "Look long enough — someone looks back.",
    icon: createElement(Sparkles, { className: "h-6 w-6" }),
    x: 12, // gilded mirror on the left wall
    y: 27,
    accentClass: "text-tavern-gold",
  },
  {
    href: "/bard",
    label: "Bard's Stage",
    flavor: "A song for every feat.",
    icon: createElement(Music, { className: "h-6 w-6" }),
    x: 82, // raised stage + lute on the right
    y: 50,
    accentClass: "text-tavern-ale",
  },
  {
    href: "/table",
    label: "Round Table",
    flavor: "Your roster of heroes.",
    icon: createElement(Users, { className: "h-6 w-6" }),
    x: 11, // oak table in the front-left foreground
    y: 75,
    accentClass: "text-tavern-parchment",
  },
  {
    href: "/board",
    label: "Notice Board",
    flavor: "Friends, parties, open seats.",
    icon: createElement(ScrollText, { className: "h-6 w-6" }),
    x: 64, // posted parchments on the right-back wall
    y: 25,
    accentClass: "text-tavern-parchment",
  },
];
