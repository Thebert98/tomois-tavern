"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

const fieldClasses =
  "w-full rounded-lg border border-tavern-stone/35 bg-tavern-night px-3 py-2 text-sm text-tavern-parchment outline-none transition-colors placeholder:text-tavern-stone focus:border-tavern-gold/80 focus:ring-2 focus:ring-tavern-gold/30";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldClasses, className)} {...rest} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(fieldClasses, "min-h-[6rem] leading-relaxed", className)}
    {...rest}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  children,
  className,
  htmlFor,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block font-heading text-xs uppercase tracking-[0.3em] text-tavern-gold",
        className,
      )}
    >
      {children}
    </label>
  );
}
