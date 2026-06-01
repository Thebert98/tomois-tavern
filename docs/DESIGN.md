# Tomoi's Tavern — Design Book

> A coherent visual + interaction system every feature must conform to.
> When in doubt, choose the option that makes the tavern feel **warm**
> and **bustling** without becoming a theme-park pastiche.

---

## 1. Voice & Tone

Imagine a real medieval-fantasy tavern keeper writing the UI copy: warm,
direct, a touch poetic, never cute. Avoid modern slang; avoid theme-park
fake-old-English ("Yon ye olde portrait shoppe!"). Aim for the register
of a Tolkien chapter heading or a Pillars of Eternity tooltip.

| Yes | No |
|---|---|
| "Step inside, traveller." | "Welcome to Tomoi's app!" |
| "The mirror tires sometimes — try again." | "Error: 502 Bad Gateway" |
| "Speak the words again." | "Please retry your input." |
| "Who joins your table?" | "Add party members" |
| "A raven's flown with your confirmation." | "Email sent." |

System messages keep noun + verb tavern metaphors:
*painting* a portrait, *singing* a song, *rolling* a hero, *posting* to the
notice board, *summoning* a friend.

Errors lean toward agency ("the mirror tires", "the raven was lost") so the
user feels invited to retry rather than blamed.

---

## 2. Palette

Anchored on warm candlelight on deep night. Every screen sits on
`tavern-night`; brightness comes from fire / gold accents.

| Token | Hex | Use |
|---|---|---|
| `tavern-night` | `#0d0a08` | Base background; never used for text on text. |
| `tavern-oak` | `#3b261a` | Furniture; secondary surfaces; tooltip backs. |
| `tavern-stone` | `#7a6b56` | Muted text, borders, separators. |
| `tavern-parchment` | `#f3e6c8` | Primary text on dark surfaces. |
| `tavern-gold` | `#d4af37` | Brand accent; focus rings; the "active" badge; section headings. |
| `tavern-ember` | `#c66b2d` | Primary action buttons; the hearth. |
| `tavern-fire` | `#f0a050` | Hover state of ember; live flame elements. |
| `tavern-blood` | `#872322` | Errors; destructive confirmations. |
| `tavern-ale` (new) | `#b87a2b` | Amber accents (mead, songs, lore). |
| `tavern-moss` (new) | `#5d6b3e` | Quiet "success" state without screaming green. |
| `tavern-candle` (new) | `#f5d18a` | Soft highlight glints — text on gold buttons, sparkle SFX. |

Opacity ladder for borders/text on dark backgrounds:
**90% = primary text · 65% = secondary · 45% = tertiary · 25% = decoration · 12% = hairline borders.**
Use `text-tavern-parchment/65` etc. rather than picking a new color.

Contrast targets:
- Body text on `tavern-night` should hit WCAG AA (4.5:1). `tavern-parchment` (#f3e6c8) on `tavern-night` (#0d0a08) measures ~16:1 — safe.
- Active states on gold need text in `tavern-night` (~14:1).
- Never put `tavern-stone` text on `tavern-night` — it's ~4:1, just under AA for small text.

---

## 3. Typography

Two faces. No third unless the design book is updated.

- **Heading (Cinzel)** — `font-heading`. Reserved for: page titles, section
  headers, button labels, badges, tooltip titles. Always
  `uppercase tracking-[0.2em]` minimum, often `tracking-[0.3em]–[0.4em]`
  for hero text. Cinzel is a Roman-inscription face; tight tracking
  flattens it.
- **Body (EB Garamond)** — `font-body`. Everything else. Italic for
  flavor/tooltip prose ("the fire's warm").

Sizes (Tailwind tokens):

| Use | Class |
|---|---|
| Hero (`h1` on a room) | `text-4xl font-heading uppercase tracking-[0.2em]` |
| Page title (tavern marquee) | `text-2xl font-heading uppercase tracking-[0.4em]` |
| Section header | `text-xs font-heading uppercase tracking-[0.3em]` |
| Body | `text-sm` or `text-base` body font |
| Flavor / italic notes | `text-xs italic text-tavern-parchment/55` |
| Tag / chip | `text-[0.65rem] font-heading uppercase tracking-[0.2em]` |

Numerals on `text-tabular-nums` whenever they tick (progress %, counts).

---

## 4. Motion vocabulary

Four named motions. Anything you add should fit one of these or get added
to the book.

1. **flicker** — the fire's pulse. Keyframes already in `globals.css`.
   Used on flame icons, hearth elements, the mirror swirl.
2. **breath** — a 4-6s subtle scale 0.99→1.01 loop. For sprites, ember
   glow, the bard's lute. Implies "alive at rest".
3. **unfurl** — a y-translate + opacity + skew-y for scrolls and notice
   board entries appearing. Spring `{stiffness: 120, damping: 16}`.
4. **settle** — a small bounce-in (scale 0.96 → 1.02 → 1) for elements
   that "fit into place" — modal open, room transition end, card snap.

Hover animations follow Hotspot's pattern: `whileHover={scale: 1.07}`,
`whileTap={scale: 0.96}`. Never animate hover position; never animate
backgrounds longer than 200ms.

Page transitions between rooms are a 220ms cross-fade with the tavern
darkening to night briefly. (Implemented in the layout, not per-route.)

`prefers-reduced-motion: reduce` disables flicker, breath, and the page
fade. Springs become tween. (Add to globals.css.)

---

## 5. Sound design

Sound is **off by default**. There's a small mute toggle that persists
in `localStorage`. When on:

- **ambient.mp3** — low-volume tavern loop: distant chatter, fire crackle,
  mug clinks, the occasional lute string. Plays everywhere except
  `/sign-in`. Volume 0.35.
- **door.mp3** — short creak on entering a room from the scene. Plays once
  per route push. Volume 0.6.
- **scroll-unfurl.mp3** — soft paper rustle on Notice Board entries
  appearing.
- **embers.mp3** — gentle pop when an action completes successfully (a
  portrait lands, a song finishes).
- **mug.mp3** — short clink when copying a share link or marking a
  portrait active.

Implementation: a single `useAmbient()` hook backed by Howler.js. Mount
once at the root; switch tracks on route change. SFX use a registry:
`playSfx('embers')`. Never autoplay above 0.4 master volume on first load
(per browser policy + user respect).

If we ship without audio assets (which we will at first), the hook is a
no-op and the UI never references nonexistent files. Audio is purely
additive.

---

## 6. Component library (packages/ui)

Every common UI element used by more than one page lives in
`packages/ui/src/`. Each component is themed with the tavern tokens and
documented inline.

| Component | Purpose | Notes |
|---|---|---|
| `cn` (exists) | Tailwind class merging | Keep. |
| `Button` | Primary, secondary, ghost, danger. | Heading font, uppercase, embered focus ring. Sizes: `sm`/`md`/`lg`. |
| `Card` | Tavern card with optional oak border + gold corner stamp. | Background `tavern-night/70`, backdrop-blur, border `gold/30`. |
| `Input` / `Textarea` | Already used inline; promote to a shared component with consistent placeholder color & focus ring. | |
| `Modal` | Centered with vignette overlay. `settle` animation on open. Has `<Modal.Header>`, `<Modal.Body>`, `<Modal.Footer>`. | |
| `ConfirmDialog` | Built on Modal. Two buttons (cancel + danger). For deletes. | |
| `Toast` + `Toaster` | Bottom-right stack. Tavern flavor (`A vision was banished from the gallery.`). Auto-dismiss 4s. | |
| `EmptyState` | Icon + heading + sub + optional action button. Used by every room when there's no data. | |
| `Skeleton` | Pulsing parchment-tinted block. For loading states. | |
| `Avatar` | Round-cornered image with fallback initials over `oak`. Sizes: `sm`/`md`/`lg`. | Used by Notice Board + Round Table. |
| `Chip` / `Tag` | Small heading-font pill for status / labels. | |
| `Tooltip` | Oak background, gold thin border, parchment text, fade-in 80ms. | |
| `SignBoard` | A signage frame (wood + gold trim) wrapping its children. For room headers + the Notice Board entries. | |

Each is implemented as a forwardRef function component with a `className`
override prop merged through `cn`. No CSS modules. No styled-components.
Pure Tailwind tokens.

---

## 7. Layout & responsive

Three breakpoints follow Tailwind defaults: `sm` (640), `md` (768),
`lg` (1024). The tavern scene is the only "free-positioned" layout;
everything else stacks.

| Surface | Mobile | Tablet | Desktop |
|---|---|---|---|
| Tavern scene (`/`) | A vertical scroll of "place cards" (one hotspot per card) with parallax flame imagery. | 2-col grid of place cards. | Full immersive single-screen hotspot scene (current behaviour). |
| Room shell (every other route) | Stack, max width 100%. | Stack, max-width 720. | 2-col where applicable, max-width 1080. |
| Tavern HUD | Compact (logo only + menu). | Compact + active-character chip. | Full (logo + chip + notif + sign-out). |
| Modals | Full-screen sheet sliding from bottom. | Centered, max-width 560. | Centered, max-width 560. |

Container padding: `px-6 md:px-8`. Vertical rhythm: section gap `mt-8`,
sub-section `mt-4`.

Always cap interactive-area width: forms `max-w-md`, content `max-w-3xl`,
gallery grids span full content width.

---

## 8. Accessibility baseline

- Every interactive element has a visible **focus ring**:
  `focus-visible:ring-2 focus-visible:ring-tavern-gold focus-visible:outline-none`.
- All buttons + icon-only buttons have an `aria-label`.
- The tavern scene's hotspots are keyboard navigable (`Tab` moves through
  them in scene reading order). When focused, the same hover tooltip shows.
- Color is never the only signal — active portraits get a border AND a
  badge.
- `prefers-reduced-motion`: all keyframes go through `media (prefers-reduced-motion: reduce)`
  and become a no-op.
- Form errors are read out via `role="alert"` (already the pattern in
  sign-in).
- Modals trap focus until dismissed.

---

## 9. Per-room sensory palette

| Room | Anchor color | Sound cue (when audio on) | Tooltip flavor |
|---|---|---|---|
| Tavern scene | `tavern-fire` everywhere | ambient loop | "Step in, traveller." |
| Fireplace | `tavern-ember` (warmth) | door creak on enter | "Stoke the embers — roll a hero." |
| Magic Mirror | `tavern-gold` (frame) | gentle chime on portrait ready | "Look long enough, and someone looks back." |
| Bard's Stage | `tavern-ale` (amber) | a single lute pluck on enter | "A song for every feat." |
| Round Table | `tavern-oak` (table wood) | mug clink on row hover | "Your roster of heroes." |
| Notice Board | `tavern-parchment` (paper) | scroll unfurl | "Friends, parties, open seats." |

Each room uses its anchor color for: the room title underline, the primary
action button (overriding `tavern-ember` if it differs), and the empty-state
icon.

---

## 10. Voice glossary

For consistency, use the same noun for each concept everywhere.

- **Traveller** — the signed-in user.
- **Hero** — a character.
- **Vision** — a portrait.
- **Song** — a generated track from the Bard.
- **Tale** — a lore entry. (Used by the Bard when scoping to lore.)
- **Party** — a group.
- **Roster** — a list of heroes (in Round Table).
- **Notice** — a board entry (invitation, party post).
- **Embers** — credits/usage (when we surface it).
- **The hearth / the mirror / the stage / the table / the board** —
  always lowercase except in titles.

---

*Last updated 2026-06-01. When adding a new feature, update this file
in the same PR. The book is the source of truth; conflicts go in the
book's favor, then the implementation gets fixed.*
