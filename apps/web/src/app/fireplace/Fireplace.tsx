"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Flame,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Textarea,
  useToast,
} from "@tomois/ui";
import { reroll } from "@/lib/api";
import { playSfx } from "@/lib/sfx";

/**
 * The Fireplace — new-hero forge.
 *
 * Flow:
 *   1. user enters a name (required) + optional vibe + optional identity locks
 *   2. POST /characters (empty sheet)
 *   3. if any locks were set, PUT /characters/{id} with those fields locked
 *   4. POST /characters/{id}/generate with the vibe as user_notes
 *   5. redirect to /table?character=<id>
 *
 * Existing-character editing lives at the Round Table (Edit modal /
 * Level-up wizard). See docs/PLAN.md.
 */

interface IdentityLocks {
  race: string;
  char_class: string;
  background: string;
  alignment: string;
}

const EMPTY_LOCKS: IdentityLocks = {
  race: "",
  char_class: "",
  background: "",
  alignment: "",
};

function buildLockedSheet(locks: IdentityLocks): Record<string, unknown> | null {
  const patches: Record<string, unknown> = {};
  let any = false;
  (Object.keys(locks) as Array<keyof IdentityLocks>).forEach((k) => {
    const v = locks[k].trim();
    if (v) {
      patches[k] = { value: v, locked: true };
      any = true;
    }
  });
  return any ? patches : null;
}

export function Fireplace() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState("");
  const [locks, setLocks] = useState<IdentityLocks>(EMPTY_LOCKS);
  const [showLocks, setShowLocks] = useState(false);
  const [stage, setStage] = useState<
    "idle" | "stoking" | "painting" | "done"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  function setLock<K extends keyof IdentityLocks>(k: K, v: string) {
    setLocks((cur) => ({ ...cur, [k]: v }));
  }

  async function roll() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Give the hero a name first.", { tone: "error" });
      return;
    }
    setError(null);
    setStage("stoking");
    try {
      const created = await reroll.createCharacter(trimmed);
      const patches = buildLockedSheet(locks);
      if (patches) {
        await reroll.update(created.id, { sheet: patches });
      }
      setStage("painting");
      await reroll.generate(created.id, vibe.trim());
      void playSfx("embers");
      setStage("done");
      toast(`${trimmed} steps from the fire.`, { tone: "success" });
      router.push(`/table?character=${created.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The fire wouldn't catch.";
      if (msg.includes("429")) {
        setError(
          "The fire is spent for the day (20 rerolls/day). Try again tomorrow.",
        );
      } else {
        setError(msg.replace(/^\d+:\s*/, ""));
      }
      setStage("idle");
    }
  }

  const rolling = stage !== "idle" && stage !== "done";

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden">
        <Hearth stage={stage} />

        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="hero-name">Hero&apos;s name</Label>
            <Input
              id="hero-name"
              autoFocus
              placeholder="e.g. Kael Stormbreaker"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !rolling) void roll();
              }}
              disabled={rolling}
            />
          </div>

          <div>
            <Label htmlFor="hero-vibe">
              Whisper to the fire (optional)
            </Label>
            <Textarea
              id="hero-vibe"
              rows={3}
              placeholder="e.g. a tragic backstory tied to the burned harbor; lean spell-heavy."
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              disabled={rolling}
            />
          </div>

          {/* Optional identity locks */}
          <div>
            <button
              type="button"
              onClick={() => setShowLocks((s) => !s)}
              aria-expanded={showLocks}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-heading text-[0.65rem] uppercase tracking-[0.25em] text-tavern-parchment/70 hover:bg-tavern-night/40 hover:text-tavern-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tavern-gold"
            >
              {showLocks ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              set the bones (optional)
            </button>
            {showLocks && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <LockField
                  id="lock-race"
                  label="Race"
                  placeholder="Half-Elf"
                  value={locks.race}
                  onChange={(v) => setLock("race", v)}
                  disabled={rolling}
                />
                <LockField
                  id="lock-class"
                  label="Class"
                  placeholder="Cleric"
                  value={locks.char_class}
                  onChange={(v) => setLock("char_class", v)}
                  disabled={rolling}
                />
                <LockField
                  id="lock-background"
                  label="Background"
                  placeholder="Acolyte"
                  value={locks.background}
                  onChange={(v) => setLock("background", v)}
                  disabled={rolling}
                />
                <LockField
                  id="lock-alignment"
                  label="Alignment"
                  placeholder="Lawful Good"
                  value={locks.alignment}
                  onChange={(v) => setLock("alignment", v)}
                  disabled={rolling}
                />
                <p className="text-xs italic text-tavern-parchment/55 sm:col-span-2">
                  Anything you fill here becomes a locked field — the AI will
                  honor it as a hard constraint and roll the rest around it.
                </p>
              </div>
            )}
          </div>

          {error && (
            <Card compact className="border-tavern-blood/50 bg-tavern-blood/10">
              <p className="flex items-start gap-2 text-sm text-tavern-blood">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            </Card>
          )}

          <Button size="lg" onClick={roll} disabled={rolling}>
            <Flame className="h-4 w-4" />
            {stage === "stoking"
              ? "stoking the embers…"
              : stage === "painting"
                ? "painting your hero…"
                : stage === "done"
                  ? "to the table…"
                  : "roll a hero"}
          </Button>
        </div>
      </Card>

      <p className="mt-4 text-center text-xs italic text-tavern-parchment/45">
        Existing heroes live at the{" "}
        <a href="/table" className="text-tavern-gold/80 hover:text-tavern-gold">
          Round Table
        </a>
        .
      </p>
    </div>
  );
}

function LockField({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label htmlFor={id} className="mb-0">
          {label}
        </Label>
        {value.trim() && (
          <Chip tone="active">
            <Sparkles className="h-3 w-3" />
            locked
          </Chip>
        )}
      </div>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function Hearth({ stage }: { stage: "idle" | "stoking" | "painting" | "done" }) {
  const live = stage !== "idle" && stage !== "done";
  return (
    <div className="relative mx-auto h-32 w-full overflow-hidden rounded-lg border border-tavern-stone/35 bg-gradient-to-b from-tavern-night via-[#1a1208] to-[#0a0604]">
      <div className="absolute inset-0 flex items-center justify-center">
        <Flame
          className={`h-12 w-12 ${live ? "flicker text-tavern-fire" : "breath text-tavern-fire/60"}`}
        />
      </div>
      {live && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 60%, rgba(240,160,80,0.35), transparent 60%)",
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
        />
      )}
      <p className="absolute inset-x-0 bottom-2 text-center text-[0.6rem] uppercase tracking-[0.3em] text-tavern-parchment/55">
        {stage === "stoking"
          ? "stoking the embers"
          : stage === "painting"
            ? "the fire paints your hero"
            : stage === "done"
              ? "the hearth rests"
              : "stoke the fire to roll a hero"}
      </p>
    </div>
  );
}
