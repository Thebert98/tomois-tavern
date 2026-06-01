"use client";

import { ImgHTMLAttributes } from "react";
import { cn } from "./cn";

type Size = "sm" | "md" | "lg" | "xl";

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "size" | "src" | "alt"> {
  /** Image URL; if null/missing, falls back to initials. */
  src?: string | null;
  /** Display name used for alt + initials. */
  name: string;
  size?: Size;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-7 w-7 text-[0.6rem]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-20 w-20 text-base",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function Avatar({ src, name, size = "md", className, ...rest }: AvatarProps) {
  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-tavern-gold/30 bg-tavern-oak text-tavern-gold",
    sizeClasses[size],
    className,
  );
  if (!src) {
    return (
      <span aria-label={name} className={base}>
        <span className="font-heading uppercase tracking-[0.1em]">
          {initials(name)}
        </span>
      </span>
    );
  }
  return (
    <span className={base}>
      <img
        src={src}
        alt={name}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        {...rest}
      />
    </span>
  );
}
