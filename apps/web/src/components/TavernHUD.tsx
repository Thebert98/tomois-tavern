"use client";

import Link from "next/link";
import { LogOut, Volume2, VolumeX } from "lucide-react";
import { Tooltip } from "@tomois/ui";
import { useAuth } from "./auth/AuthProvider";
import { useAmbient } from "@/hooks/useAmbient";

/**
 * Persistent HUD overlay: brand mark, sign-out, audio toggle.
 * Sits above every route. Hidden on /sign-in.
 */
export function TavernHUD({ hidden = false }: { hidden?: boolean }) {
  const { session, signOut } = useAuth();
  const { muted, toggle } = useAmbient();
  if (hidden || !session) return null;

  const email = session.user.email ?? "";
  const traveller = email.split("@")[0] || "traveller";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-2 p-4 sm:px-6">
      <Link
        href="/"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-tavern-night/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
      >
        <span aria-hidden className="text-base">🍻</span>
        <span className="font-heading text-xs uppercase tracking-[0.35em] text-tavern-gold sm:text-sm">
          Tomoi&apos;s Tavern
        </span>
      </Link>
      <div className="pointer-events-auto flex items-center gap-1 sm:gap-2">
        <span className="hidden text-[0.65rem] italic text-tavern-parchment/55 sm:inline">
          welcome, {traveller}
        </span>
        <Tooltip content={muted ? "Wake the tavern" : "Hush the tavern"}>
          <button
            type="button"
            aria-label={muted ? "Enable audio" : "Mute audio"}
            onClick={toggle}
            className="rounded-md p-2 text-tavern-parchment/65 transition-colors hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </Tooltip>
        <Tooltip content="Leave the tavern">
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => void signOut()}
            className="rounded-md p-2 text-tavern-parchment/65 transition-colors hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
