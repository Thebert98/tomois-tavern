"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-tavern-ember text-tavern-night hover:bg-tavern-fire shadow-[0_8px_24px_-12px_rgba(240,160,80,0.65)]",
  secondary:
    "border border-tavern-stone/40 bg-tavern-night/60 text-tavern-parchment hover:border-tavern-gold/70 hover:bg-tavern-night/80",
  ghost:
    "text-tavern-parchment/70 hover:text-tavern-gold hover:bg-tavern-night/40",
  danger:
    "bg-tavern-blood text-tavern-parchment hover:bg-[#a02a29] shadow-[0_8px_24px_-12px_rgba(135,35,34,0.65)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[0.65rem] tracking-[0.18em]",
  md: "px-3.5 py-2 text-xs tracking-[0.22em]",
  lg: "px-5 py-3 text-sm tracking-[0.25em]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", children, type = "button", ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-heading uppercase",
        "transition-colors focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-tavern-gold focus-visible:ring-offset-2 focus-visible:ring-offset-tavern-night",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";
