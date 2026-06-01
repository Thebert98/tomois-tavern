"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function SignInPage() {
  const router = useRouter();
  const { supabase, session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    router.replace("/");
    return null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (mode === "signup") {
      setSent(true);
    } else {
      router.replace("/");
    }
  }

  return (
    <main className="vignette relative flex min-h-[100svh] flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <h1 className="font-heading text-3xl uppercase tracking-[0.4em] text-tavern-gold">
          Tomoi&apos;s Tavern
        </h1>
        <p className="mt-2 italic text-tavern-parchment/60">
          {mode === "signin"
            ? "Step inside, traveller."
            : "What name shall we call you?"}
        </p>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-tavern-gold/30 bg-tavern-night/70 p-7 shadow-2xl backdrop-blur">
        {sent ? (
          <p className="text-center text-sm italic text-tavern-parchment/80">
            A raven&apos;s flown with your confirmation. Check your inbox, then
            sign in.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-tavern-stone/30 bg-tavern-night px-3 py-2 text-sm outline-none placeholder:text-tavern-stone focus:border-tavern-gold"
            />
            <input
              type="password"
              required
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-tavern-stone/30 bg-tavern-night px-3 py-2 text-sm outline-none placeholder:text-tavern-stone focus:border-tavern-gold"
            />
            {error && (
              <p className="text-sm text-tavern-blood" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-tavern-ember px-3 py-2 font-heading uppercase tracking-[0.2em] text-tavern-night shadow-lg transition-colors hover:bg-tavern-fire disabled:opacity-50"
            >
              {submitting ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
            </button>
            <button
              type="button"
              className="w-full text-xs italic text-tavern-parchment/50 hover:text-tavern-gold"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "New here? Create an account"
                : "Have an account? Sign in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
