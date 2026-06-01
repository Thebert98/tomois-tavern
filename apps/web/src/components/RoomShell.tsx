import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

interface RoomShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function RoomShell({ title, subtitle, children }: RoomShellProps) {
  return (
    <div className="min-h-[100svh] bg-tavern-night px-6 py-10 text-tavern-parchment">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.3em] text-tavern-parchment/60 transition-colors hover:text-tavern-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          back to the tavern
        </Link>
        <h2 className="mt-6 font-heading text-4xl uppercase tracking-[0.2em] text-tavern-gold">
          {title}
        </h2>
        <p className="mt-2 italic text-tavern-parchment/60">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
