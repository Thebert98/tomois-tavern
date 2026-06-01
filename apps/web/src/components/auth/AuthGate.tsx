"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

/** Wrap any client route that requires a signed-in user. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/sign-in");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center text-tavern-parchment/50">
        <p className="italic">The tavern doors creak open…</p>
      </div>
    );
  }
  return <>{children}</>;
}
