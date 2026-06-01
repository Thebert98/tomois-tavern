"use client";

import { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-tavern-stone/35 bg-tavern-night/40 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <div className="text-tavern-gold/70">{icon}</div>}
      <h3 className="font-heading text-sm uppercase tracking-[0.3em] text-tavern-parchment">
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-xs italic text-tavern-parchment/55">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
