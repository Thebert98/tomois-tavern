"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Music,
  Flame,
  ScrollText,
  Users,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  Modal,
  Skeleton,
  SignBoard,
  Textarea,
  Tooltip,
  useToast,
} from "@tomois/ui";
import { unfurl } from "@/lib/motion";
import { Wizard, type WizardStep } from "@/components/wizard/Wizard";
import { LockedField } from "@/components/wizard/LockedField";
import { PlayStylePicker } from "@/components/wizard/PlayStylePicker";
import type { PlayStyle } from "@/lib/playstyle";
import { RollingDialog, type RollingStage } from "@/components/RollingDialog";
import { heritageRaces, namingConventionFor } from "@/lib/heritage";

/**
 * Living style guide. Renders every primitive, palette token, motion
 * pattern and voice sample from docs/DESIGN.md so they're verifiable and
 * the design system is browsable in one place.
 *
 * No auth gate by design — anyone can browse the style, even unsigned-in.
 */
const PALETTE: { name: string; var: string; hex: string; note: string }[] = [
  { name: "tavern-night", var: "--color-tavern-night", hex: "#0d0a08", note: "Base background" },
  { name: "tavern-oak", var: "--color-tavern-oak", hex: "#3b261a", note: "Furniture, tooltips" },
  { name: "tavern-stone", var: "--color-tavern-stone", hex: "#7a6b56", note: "Muted text, borders" },
  { name: "tavern-parchment", var: "--color-tavern-parchment", hex: "#f3e6c8", note: "Primary text" },
  { name: "tavern-gold", var: "--color-tavern-gold", hex: "#d4af37", note: "Accent, focus" },
  { name: "tavern-ember", var: "--color-tavern-ember", hex: "#c66b2d", note: "Primary action" },
  { name: "tavern-fire", var: "--color-tavern-fire", hex: "#f0a050", note: "Live flame, hover" },
  { name: "tavern-blood", var: "--color-tavern-blood", hex: "#872322", note: "Errors, danger" },
  { name: "tavern-ale", var: "--color-tavern-ale", hex: "#b87a2b", note: "Amber, songs" },
  { name: "tavern-moss", var: "--color-tavern-moss", hex: "#5d6b3e", note: "Quiet success" },
  { name: "tavern-candle", var: "--color-tavern-candle", hex: "#f5d18a", note: "Soft highlight" },
];

const VOICE = [
  { yes: "Step inside, traveller.", no: "Welcome to Tomoi's app!" },
  { yes: "The mirror tires — try again.", no: "Error: 502 Bad Gateway" },
  { yes: "Speak the words again.", no: "Please retry your input." },
  { yes: "A raven's flown with your confirmation.", no: "Email sent." },
  { yes: "Who joins your table?", no: "Add party members" },
];

const ROOMS = [
  { name: "Fireplace", icon: Flame, color: "text-tavern-fire" },
  { name: "Mirror", icon: Sparkles, color: "text-tavern-gold" },
  { name: "Stage", icon: Music, color: "text-tavern-ale" },
  { name: "Table", icon: Users, color: "text-tavern-parchment" },
  { name: "Board", icon: ScrollText, color: "text-tavern-parchment" },
];

export default function DesignPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unfurlKey, setUnfurlKey] = useState(0);

  return (
    <div className="min-h-[100svh] bg-tavern-night px-6 py-24 text-tavern-parchment">
      <div className="mx-auto max-w-5xl space-y-16">
        <header>
          <p className="font-heading text-[0.65rem] uppercase tracking-[0.4em] text-tavern-parchment/45">
            internal — design system
          </p>
          <h1 className="mt-2 font-heading text-3xl uppercase tracking-[0.25em] text-tavern-gold">
            The Tavern Style Book
          </h1>
          <p className="mt-3 max-w-2xl text-sm italic text-tavern-parchment/70">
            A living rendering of every primitive, motion, and voice rule
            from <code>docs/DESIGN.md</code>. If a primitive isn&apos;t here,
            it isn&apos;t in the system.
          </p>
        </header>

        <Section title="Palette" eyebrow="§2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PALETTE.map((p) => (
              <div
                key={p.name}
                className="overflow-hidden rounded-lg border border-tavern-stone/30"
              >
                <div
                  className="h-16"
                  style={{ background: `var(${p.var})` }}
                  aria-hidden
                />
                <div className="bg-tavern-night/60 p-2">
                  <div className="font-heading text-[0.65rem] uppercase tracking-[0.2em] text-tavern-parchment/85">
                    {p.name}
                  </div>
                  <div className="font-body text-[0.6rem] text-tavern-parchment/50">
                    {p.hex} · {p.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" eyebrow="§3">
          <div className="space-y-4">
            <div>
              <Eyebrow>Heading — Cinzel · uppercase · tracked</Eyebrow>
              <h2 className="font-heading text-3xl uppercase tracking-[0.2em] text-tavern-gold">
                Roll your legend
              </h2>
              <h3 className="mt-2 font-heading text-base uppercase tracking-[0.3em] text-tavern-parchment">
                A section header
              </h3>
            </div>
            <div>
              <Eyebrow>Body — EB Garamond · italic for flavor</Eyebrow>
              <p className="text-base text-tavern-parchment">
                The hearth burns low. The lute is in tune. Travellers come
                and go.
              </p>
              <p className="mt-1 text-xs italic text-tavern-parchment/55">
                a small, italic flavor note
              </p>
            </div>
          </div>
        </Section>

        <Section title="Motion" eyebrow="§4">
          <div className="grid gap-4 sm:grid-cols-4">
            <MotionDemo title="flicker" desc="hot things">
              <Flame className="h-8 w-8 text-tavern-fire flicker" />
            </MotionDemo>
            <MotionDemo title="breath" desc="alive at rest">
              <div className="breath flex h-12 w-12 items-center justify-center rounded-full border border-tavern-gold/40 bg-tavern-night text-tavern-gold">
                ♪
              </div>
            </MotionDemo>
            <MotionDemo title="settle" desc="modal open">
              <Button size="sm" onClick={() => setModalOpen(true)}>
                trigger
              </Button>
            </MotionDemo>
            <MotionDemo title="unfurl" desc="lists arriving">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setUnfurlKey((k) => k + 1)}
              >
                replay
              </Button>
            </MotionDemo>
          </div>
          <ul className="mt-4 space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <motion.li
                key={`${unfurlKey}-${i}`}
                variants={unfurl}
                initial="hidden"
                animate="visible"
                custom={i}
                className="rounded-md border border-tavern-stone/30 bg-tavern-night/50 px-3 py-1.5 text-xs italic text-tavern-parchment/80"
              >
                a notice unfurls onto the board
              </motion.li>
            ))}
          </ul>
        </Section>

        <Section title="Buttons" eyebrow="§6 Button">
          <div className="flex flex-wrap items-end gap-3">
            <Button size="sm">primary sm</Button>
            <Button>primary md</Button>
            <Button size="lg">primary lg</Button>
            <Button variant="secondary">secondary</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="danger">
              <Trash2 className="h-4 w-4" />
              danger
            </Button>
            <Button disabled>disabled</Button>
          </div>
        </Section>

        <Section title="Inputs" eyebrow="§6 Input">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="demo-text">Text</Label>
              <Input id="demo-text" placeholder="A weather-beaten ranger…" />
            </div>
            <div>
              <Label htmlFor="demo-num">Number</Label>
              <Input id="demo-num" type="number" placeholder="3" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="demo-area">Textarea</Label>
              <Textarea id="demo-area" rows={3} placeholder="Whisper to the bard…" />
            </div>
          </div>
        </Section>

        <Section title="Cards, chips, skeletons" eyebrow="§6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <h4 className="font-heading text-sm uppercase tracking-[0.3em] text-tavern-parchment">
                Plain card
              </h4>
              <p className="mt-1 text-xs italic text-tavern-parchment/60">
                bg-tavern-night/70 + gold border
              </p>
            </Card>
            <Card seal>
              <h4 className="font-heading text-sm uppercase tracking-[0.3em] text-tavern-parchment">
                With a gold seal
              </h4>
              <p className="mt-1 text-xs italic text-tavern-parchment/60">
                top-right wax stamp
              </p>
            </Card>
            <Card compact>
              <div className="flex flex-wrap gap-2">
                <Chip>default</Chip>
                <Chip tone="active">
                  <Check className="h-3 w-3" />
                  active
                </Chip>
                <Chip tone="warning">warning</Chip>
                <Chip tone="muted">muted</Chip>
              </div>
              <div className="mt-3 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-3 w-24" />
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Avatars, tooltips" eyebrow="§6">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex items-end gap-3">
              <Avatar size="sm" name="Kael Stormbreaker" />
              <Avatar size="md" name="Lyra of the Vale" />
              <Avatar size="lg" name="Thorin" />
              <Avatar size="xl" name="Mira Sundance" />
            </div>
            <Tooltip content="The hearth crackles a welcome.">
              <Button variant="secondary">hover me</Button>
            </Tooltip>
          </div>
        </Section>

        <Section title="SignBoard" eyebrow="§6">
          <SignBoard
            title="The Crooked Crown"
            subtitle="4 at the table · founded last spring"
          >
            <p className="text-sm italic text-tavern-parchment/70">
              Wooden plank with a thin gold inner border. Used by the Notice
              Board for party details and any sign-over-a-doorway framing.
            </p>
          </SignBoard>
        </Section>

        <Section title="Empty state + modal" eyebrow="§6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No parties yet"
              description="Found one — gather your friends and bring your heroes."
              action={
                <Button>
                  <Plus className="h-4 w-4" />
                  found the first party
                </Button>
              }
            />
            <div className="flex flex-col gap-2">
              <Button onClick={() => setModalOpen(true)}>open modal</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                open confirm
              </Button>
              <Button
                variant="ghost"
                onClick={() => toast("A vision was banished from the gallery.", { tone: "success" })}
              >
                show toast
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Tavern atmospherics" eyebrow="§5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative h-32 overflow-hidden rounded-lg border border-tavern-stone/30 bg-tavern-night/60">
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  aria-hidden
                  className="flicker block h-20 w-20 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(245,209,138,0.55) 0%, transparent 60%)",
                    filter: "blur(2px)",
                  }}
                />
              </div>
              <div className="absolute bottom-1 left-2 font-heading text-[0.55rem] uppercase tracking-[0.2em] text-tavern-parchment/55">
                lantern glow (flicker)
              </div>
            </div>
            <div className="relative h-32 overflow-hidden rounded-lg border border-tavern-stone/30 bg-tavern-night/60">
              <div className="absolute inset-0 flex items-end justify-center pb-3">
                <span
                  aria-hidden
                  className="breath block h-16 w-12 text-tavern-night/85"
                >
                  <svg
                    viewBox="0 0 40 60"
                    preserveAspectRatio="xMidYMax meet"
                    className="h-full w-full"
                  >
                    <ellipse cx="20" cy="14" rx="7" ry="8" />
                    <path d="M6 30 Q20 22 34 30 L34 60 L6 60 Z" />
                  </svg>
                </span>
              </div>
              <div className="absolute bottom-1 left-2 font-heading text-[0.55rem] uppercase tracking-[0.2em] text-tavern-parchment/55">
                patron silhouette (breath)
              </div>
            </div>
          </div>
        </Section>

        <Section title="Per-room palette" eyebrow="§9">
          <div className="grid gap-3 sm:grid-cols-5">
            {ROOMS.map((r) => (
              <div
                key={r.name}
                className="flex flex-col items-center gap-2 rounded-lg border border-tavern-stone/30 bg-tavern-night/50 p-3"
              >
                <div className={`breath ${r.color}`}>
                  <r.icon className="h-6 w-6" />
                </div>
                <div className="font-heading text-[0.65rem] uppercase tracking-[0.2em] text-tavern-parchment/85">
                  {r.name}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Wizard" eyebrow="§11">
          <p className="mb-3 text-sm italic text-tavern-parchment/65">
            Used by the Fireplace and the Round Table&apos;s level-up. Two
            sample steps below — the second is optional and gates Next via{" "}
            <code className="font-mono text-xs text-tavern-gold">isValid</code>.
          </p>
          <Card>
            <DesignWizardDemo />
          </Card>
        </Section>

        <Section title="Field locks" eyebrow="§11">
          <p className="mb-3 text-sm italic text-tavern-parchment/65">
            Locked = the fire keeps the value. Free = it&apos;s offered as a
            suggestion the fire may revise. Default is locked when a value is
            set.
          </p>
          <Card>
            <FieldLockDemo />
          </Card>
        </Section>

        <Section title="Heritage / naming" eyebrow="§13">
          <p className="mb-3 text-sm italic text-tavern-parchment/65">
            Per-race naming convention paragraphs sent in{" "}
            <code className="font-mono text-xs text-tavern-gold">user_notes</code>
            . Human re-rolls a Forgotten Realms cultural strand on every
            click — refresh to see the variety.
          </p>
          <Card>
            <HeritageDemo />
          </Card>
        </Section>

        <Section title="Rolling dialog" eyebrow="§11">
          <p className="mb-3 text-sm italic text-tavern-parchment/65">
            Overlay shown while the LLM is generating, then transitions to a
            done banner with the new hero&apos;s name + race · class · level.
            Try both states.
          </p>
          <Card>
            <RollingDialogDemo />
          </Card>
        </Section>

        <Section title="Play styles" eyebrow="§12">
          <p className="mb-3 text-sm italic text-tavern-parchment/65">
            Shared stance picker — used in the Fireplace and at the Round
            Table. Influences stat recommendations and seeds the fire&apos;s
            prompt with a stance sentence.
          </p>
          <Card>
            <PlayStyleDemo />
          </Card>
        </Section>

        <Section title="Voice & tone" eyebrow="§1">
          <ul className="space-y-2">
            {VOICE.map((v) => (
              <li
                key={v.yes}
                className="grid gap-2 rounded-md border border-tavern-stone/30 bg-tavern-night/50 p-3 sm:grid-cols-2"
              >
                <div className="text-tavern-parchment">
                  <Chip tone="active" className="mb-1">
                    yes
                  </Chip>
                  <p className="text-sm italic">{v.yes}</p>
                </div>
                <div className="text-tavern-parchment/55">
                  <Chip tone="warning" className="mb-1">
                    no
                  </Chip>
                  <p className="text-sm italic">{v.no}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="A demonstration modal"
        description="settle spring on open. Focus is trapped. Escape closes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              cancel
            </Button>
            <Button onClick={() => setModalOpen(false)}>okay</Button>
          </>
        }
      >
        <p className="text-sm italic text-tavern-parchment/70">
          The body lives between the title and the footer.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          toast("Banished.", { tone: "success" });
        }}
        title="Banish this vision?"
        description="This is the destructive variant. Buttons reflect the action."
        confirmLabel="Banish"
        cancelLabel="Keep it"
      />
    </div>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-4">
        {eyebrow && (
          <p className="font-heading text-[0.6rem] uppercase tracking-[0.4em] text-tavern-parchment/40">
            {eyebrow}
          </p>
        )}
        <h2 className="font-heading text-xl uppercase tracking-[0.25em] text-tavern-gold">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 font-heading text-[0.6rem] uppercase tracking-[0.3em] text-tavern-parchment/45">
      {children}
    </p>
  );
}

interface DemoState {
  oath: string;
  weapon: string;
}

function HeritageDemo() {
  const [tick, setTick] = useState(0);
  const races = heritageRaces();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs italic text-tavern-parchment/55">
          one row per race · click to re-roll Human strand
        </span>
        <Button size="sm" variant="ghost" onClick={() => setTick((t) => t + 1)}>
          re-roll Human
        </Button>
      </div>
      <div className="space-y-3" key={tick}>
        {races.map((race) => (
          <div
            key={race}
            className="rounded-md border border-tavern-stone/30 bg-tavern-night/40 p-3"
          >
            <div className="font-heading text-[0.65rem] uppercase tracking-[0.25em] text-tavern-gold">
              {race}
            </div>
            <p className="mt-1 text-xs text-tavern-parchment/75">
              {namingConventionFor(race)}
            </p>
          </div>
        ))}
        <div className="rounded-md border border-tavern-stone/30 bg-tavern-night/40 p-3">
          <div className="font-heading text-[0.65rem] uppercase tracking-[0.25em] text-tavern-gold">
            Human (random strand)
          </div>
          <p className="mt-1 text-xs text-tavern-parchment/75">
            {namingConventionFor("Human")}
          </p>
        </div>
      </div>
    </div>
  );
}

function RollingDialogDemo() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<RollingStage>("rolling");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setStage("rolling");
            setOpen(true);
          }}
        >
          show rolling
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setStage("done");
            setOpen(true);
          }}
        >
          show done
        </Button>
      </div>
      <RollingDialog
        open={open}
        stage={stage}
        whisper="a tragic backstory tied to the burned harbor"
        hero={{
          name: "Theron Skybreaker",
          race: "Half-Elf",
          charClass: "Cleric",
          level: 1,
        }}
        onDismiss={() => setOpen(false)}
      />
    </div>
  );
}

function FieldLockDemo() {
  const [oath, setOath] = useState("");
  const [locked, setLocked] = useState(true);
  return (
    <div className="space-y-3">
      <LockedField
        htmlFor="design-lock-demo"
        label="Oath"
        locked={locked}
        onToggleLock={() => setLocked((l) => !l)}
        hint={
          locked
            ? "locked — the fire keeps this exactly."
            : "free — the fire may rework it, but treats the value as a suggestion."
        }
      >
        <Input
          id="design-lock-demo"
          placeholder="By moon and oak…"
          value={oath}
          onChange={(e) => setOath(e.target.value)}
        />
      </LockedField>
      <p className="text-[0.65rem] italic text-tavern-parchment/55">
        Submit serializes this as{" "}
        <code className="font-mono text-xs text-tavern-gold">
          {`{ value: "${oath || "…"}", locked: ${locked} }`}
        </code>
        .
      </p>
    </div>
  );
}

function PlayStyleDemo() {
  const [style, setStyle] = useState<PlayStyle>("balanced");
  return (
    <div className="space-y-3">
      <PlayStylePicker value={style} onChange={setStyle} />
      <p className="text-[0.7rem] italic text-tavern-parchment/55">
        chose: <span className="text-tavern-gold">{style}</span>. The prompt
        prefix that goes to <code className="text-tavern-gold">/generate</code>{" "}
        comes from{" "}
        <code className="font-mono text-xs text-tavern-gold">
          playStylePromptPrefix(style)
        </code>
        .
      </p>
    </div>
  );
}

function DesignWizardDemo() {
  const { toast } = useToast();
  const steps: WizardStep<DemoState>[] = [
    {
      id: "oath",
      title: "Speak your oath",
      flavor: "Required — Next stays disabled until you type something.",
      isValid: (s) => s.oath.trim().length > 0,
      render: (state, set) => (
        <Input
          autoFocus
          placeholder="By moon and oak…"
          value={state.oath}
          onChange={(e) => set({ oath: e.target.value })}
        />
      ),
    },
    {
      id: "weapon",
      title: "Pick a weapon (optional)",
      flavor: "Optional — Skip slides past.",
      optional: true,
      render: (state, set) => (
        <Input
          placeholder="A worn flute"
          value={state.weapon}
          onChange={(e) => set({ weapon: e.target.value })}
        />
      ),
    },
  ];
  return (
    <Wizard
      steps={steps}
      initialState={{ oath: "", weapon: "" }}
      completeLabel="seal the oath"
      onComplete={(s) =>
        toast(`Oath sealed: ${s.oath.trim() || "—"} · ${s.weapon.trim() || "no weapon"}`, {
          tone: "success",
        })
      }
    />
  );
}

function MotionDemo({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-tavern-stone/30 bg-tavern-night/50 p-4">
      <div className="flex h-16 items-center justify-center">{children}</div>
      <div className="text-center">
        <div className="font-heading text-[0.65rem] uppercase tracking-[0.2em] text-tavern-parchment">
          {title}
        </div>
        <div className="text-[0.6rem] italic text-tavern-parchment/55">
          {desc}
        </div>
      </div>
    </div>
  );
}
