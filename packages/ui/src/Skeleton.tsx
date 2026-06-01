"use client";

import { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded bg-tavern-parchment/10",
        className,
      )}
      {...rest}
    />
  );
}
