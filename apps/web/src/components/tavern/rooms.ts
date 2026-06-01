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

/** Single source of truth for the five tavern places. */
export const ROOMS: RoomDescriptor[] = [
  {
    href: "/fireplace",
    label: "Fireplace",
    flavor: "Stoke the embers — roll a hero.",
    icon: createElement(Flame, { className: "h-7 w-7" }),
    x: 50,
    y: 68,
    size: 16,
    accentClass: "text-tavern-fire",
  },
  {
    href: "/mirror",
    label: "Magic Mirror",
    flavor: "Look long enough — someone looks back.",
    icon: createElement(Sparkles, { className: "h-6 w-6" }),
    x: 20,
    y: 40,
    accentClass: "text-tavern-gold",
  },
  {
    href: "/bard",
    label: "Bard's Stage",
    flavor: "A song for every feat.",
    icon: createElement(Music, { className: "h-6 w-6" }),
    x: 80,
    y: 40,
    accentClass: "text-tavern-ale",
  },
  {
    href: "/table",
    label: "Round Table",
    flavor: "Your roster of heroes.",
    icon: createElement(Users, { className: "h-6 w-6" }),
    x: 28,
    y: 78,
    accentClass: "text-tavern-parchment",
  },
  {
    href: "/board",
    label: "Notice Board",
    flavor: "Friends, parties, open seats.",
    icon: createElement(ScrollText, { className: "h-6 w-6" }),
    x: 72,
    y: 78,
    accentClass: "text-tavern-parchment",
  },
];
