# CLAUDE.md — Tomoi's Tavern orientation

Quick start for an AI assistant (or a human reviewer) landing in this repo.

## What this project is

**Tomoi's Tavern** is a Next.js + FastAPI D&D companion app. Each AI tool is a
"room" in a tavern scene:

- 🔥 **Fireplace** — character generator (delegates to the sibling [ReRoll](https://github.com/Thebert98/reroll-dnd-character-generator) backend)
- 🪞 **Magic Mirror** — character portraits (Flux 1.1 Pro via fal.ai)
- 🪑 **Round Table** — character roster + edit + level-up
- 📜 **Notice Board** — friends + parties
- 🎸 **Bard's Stage** — songs (Suno via reseller + Claude lyrics)

The flagship UX comes from ReRoll: **locked-field iteration** — every sheet
field is `{value, locked, source}`, the model only fills the unlocked ones,
locks are re-asserted server-side after the LLM responds. The tavern wraps that
contract in a wizard / level-up / per-field UI.

## Repo layout

```
apps/
  web/                  Next.js 15 + Tailwind v4 + Framer Motion
    src/app/            One folder per room: fireplace/, mirror/, table/, board/, bard/
    src/lib/            srd.ts (mirror of ReRoll SRD), cascade.ts, heritage.ts,
                        srdConstraints.ts, sheet.ts, playstyle.ts, portraitPrompt.ts, api.ts
    src/components/     wizard/, app shell, room shells
services/
  workshop/             FastAPI — Mirror + Bard + Friends + Parties
    app/api/            mirror.py, bard.py, friends.py, parties.py
    app/providers/      fal.py, suno.py, lyrics.py, storage.py
    app/{auth,db,config}.py
packages/
  shared/               TS types shared with the web app
  ui/                   shadcn-style primitives: Button, Card, Modal,
                        ConfirmDialog, Toast, Skeleton, Tooltip, Chip, Input,
                        Avatar, EmptyState, SignBoard
supabase/
  migrations/           0001 → 0007 — additive schema (portraits, friendships,
                        parties, world_lore, bard_songs) + RLS + RPCs
docs/
  DESIGN.md             palette, voice, motion, component patterns
  PLAN.md               phase tracker — status block + decisions log
.github/workflows/ci.yml  type-check + build + workshop import
```

## Critical invariants

- **Locked fields never change**. ReRoll's `merge_preserving_locks` (on the
  separate sibling backend) is the hard guard; the wizard surfaces lock toggles
  but the contract is enforced at the API.
- **RLS is the floor, the API is the ceiling**. Every workshop route uses
  `user_client(user.token)` not `service_client()` (with two documented
  exceptions: the portrait BackgroundTask and the storage cleanup half of
  `delete_portrait`). The API layers field-level guards on top — e.g. only the
  party owner can set `role` on a party member, even though RLS allows the
  member to update their own row.
- **No new `process.env.*` reads outside `lib/env.ts`.** Single source of
  truth for client-side env so a missing key fails loudly in one place.
- **Voice glossary** (DESIGN.md §10). Errors lean toward agency ("the mirror
  tires", "the fire is spent"), nouns are tavern-flavoured ("vision" for
  portrait, "hero" for character, "raven" for email).

## How to make changes safely

1. **Run type-check + build.** `pnpm type-check && pnpm build` is the only
   automated gate today (CI runs the same).
2. **Workshop:** `cd services/workshop && source .venv/bin/activate &&
   python -c "from app.main import app; print('OK')"`. No test suite exists
   yet — see AUDIT.md R1.
3. **Schema changes** go through a new migration file in `supabase/migrations/`.
   Migrations are additive; never edit a shipped one.
4. **Don't add `process.env.*` reads** outside `apps/web/src/lib/env.ts`. The
   pre-merge audit checklist in PLAN.md §"Audit checkpoint" greps for them.
5. **Voice copy** — when in doubt, mimic an existing string. DESIGN.md §10
   has the glossary.

## Common pitfalls

- The wizard's `state.locks` map defaults to **all unlocked**. A typed value
  that the player doesn't lock is a *suggestion* the LLM may revise, not a
  hard constraint. This is intentional (R3 PR 7).
- `set_current_portrait` MUST go through the RPC (migration `0007`) — a
  two-step JS update has a race that violates the partial unique index.
- The Mirror's `_run_pipeline` runs as a BackgroundTask. If the worker dies
  before transitioning `stage="queued" → "painting"`, the row sits as
  "stirring…" forever. The `list_portraits` reaper marks rows older than 10
  min as failed; that's the self-healing fallback.
- Lore CRUD is intentionally deferred — `POST /songs {scope: "lore"}` now
  returns 400 explicitly.

## Where to start reading

- `apps/web/src/app/fireplace/FireplaceWizard.tsx` — the new-hero forge wizard.
- `apps/web/src/app/table/EditCharacterModal.tsx` + `LevelUpWizard.tsx` — the
  per-field-lock + reroll UX, lifted out of the original Fireplace.
- `apps/web/src/app/mirror/MirrorRoom.tsx` — portrait generation, Realtime
  subscription to the `portraits` table, gallery.
- `services/workshop/app/api/mirror.py` — fal.ai BackgroundTask pipeline.
- `docs/PLAN.md` — phase tracker + audit checkpoints + decisions log.
- `docs/DESIGN.md` — the design system every room conforms to.

## Sibling repo

The Fireplace + Round Table call `reroll.*` endpoints on the ReRoll FastAPI
service. ReRoll uses the **same Supabase project** for auth + DB; identity is
shared via the user's JWT. ReRoll's audit branch (also `fable/audit-complete`)
covers the backend layer underneath these flows.
