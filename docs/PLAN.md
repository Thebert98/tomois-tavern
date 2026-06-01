# Tomoi's Tavern — Working Plan

This document tracks the phased rollout. Update the status block as
phases land; archive completed phases at the bottom.

## Phasing

1. **Foundation** — Shared UI primitives + tavern HUD + audio scaffold.
   Lands the `Button`/`Card`/`Input`/`Modal`/`ConfirmDialog`/`Toast`/
   `EmptyState`/`Skeleton`/`Avatar`/`Chip`/`Tooltip`/`SignBoard`
   components, the `Toaster` provider, and the `useAmbient()` hook
   (no-op when no audio files).

2. **Tavern scene polish** — Interactive hotspot tooltips, dust motes,
   responsive (mobile stack → tablet grid → desktop immersive), door
   transition between rooms, parallax flame on the fireplace hotspot.

3. **Magic Mirror — delete + responsive + polish** — `DELETE /portraits/{id}`
   backend with storage cleanup. Confirm dialog + toast. Loading skeletons.
   Mobile layout (mirror on top, controls below). Empty state when no
   character is chosen.

4. **Round Table** — character roster with active-portrait avatars and
   quick-actions.

5. **Notice Board** — friends + parties. New workshop routes:
   - `POST /friends` (send request by email),
   - `PATCH /friends/{id}` (accept/reject),
   - `DELETE /friends/{id}`,
   - `POST /parties`, `GET /parties`, `PATCH /parties/{id}`,
   - `POST /parties/{id}/members`, `DELETE /parties/{id}/members/{user_id}`.
   Schema is already in `0001_tavern_init.sql`.

6. **Fireplace — ReRoll bridge** — native list/create/open against ReRoll's
   `/characters` endpoints, framed in the tavern shell.

7. **Bard's Stage** — UI flow (scope → prompt → genre → cast). Backend
   already exists in `services/workshop/app/api/bard.py`. Suno reseller
   key still pending — that's the only thing blocking real audio. UI
   works against the existing pipeline; we'll flip the key when we
   have it.

8. **Final audit** — security (RLS, secrets), accessibility, performance,
   UX polish, voice consistency.

## Audit checkpoint (run after each phase)

Before opening the phase's PR:

- [ ] `pnpm build` clean (frontend)
- [ ] `python -c "from app.main import app"` clean (workshop)
- [ ] No new direct `process.env.*` reads (must go through `lib/env.ts`)
- [ ] No new inline secrets (grep the diff for `sk-`, `sb_`, the JWT,
      the FAL UUID, the PixelLab UUID, the Supabase project ref).
- [ ] Every new backend route uses `user_client(user.token)` not
      `service_client()` (RLS-scoped, unless explicitly background-task).
- [ ] Every new backend route has a Pydantic body model — no raw
      `dict[str, Any]` accepted from the user.
- [ ] Every new frontend interactive element has a focus ring and
      either visible label or `aria-label`.
- [ ] Every new room follows the room-shell pattern (back link + title
      + subtitle + content).
- [ ] DESIGN.md updated if any new color, motion, or component was
      introduced.

## Decisions log

- 2026-06-01 — Audio is opt-in (toggle persists in `localStorage`), default
  off. We ship without real audio files first; the hook is a no-op until
  files exist. (Avoids autoplay policy issues + first-load bandwidth.)
- 2026-06-01 — Sprite/animation pipeline lives on `archive/sprites-pipeline`
  per user direction. Round Table + Notice Board avatars use the active
  **portrait** (square-cropped), not a sprite.
- 2026-06-01 — `prefers-reduced-motion` disables all keyframed motion
  (flicker, breath). Springs become linear tween.
- 2026-06-01 — Fireplace is a **native** UI talking to ReRoll's REST API
  with the user's Supabase JWT, not an iframe. Identity is shared via the
  shared Supabase project; UI surfaces the character list directly.

## Open requirements (won't block, surface when ready)

- **Suno reseller key** — pending. Without it the Bard UI ships but
  generations fail at the API call. We'll show a clear "the bard is
  resting" error.
- **Audio assets** — TBD. Files would land in `apps/web/public/audio/`.
  Until then `useAmbient()` is a no-op.
- **Hearth panorama art** — optional Flux-generated background image
  for the tavern scene to replace the gradient placeholder. Not blocking.

## Status block

- [x] Phase 0 — Plan + DESIGN.md
- [x] Phase 1 — Foundation (shared UI primitives, HUD, audio scaffold)
- [x] Phase 2 — Tavern scene polish (responsive + dust motes + door SFX)
- [x] Phase 3 — Magic Mirror delete + responsive + polish
- [x] Phase 4 — Round Table (roster, seat/rename/delete)
- [x] Phase 5 — Notice Board (friends + parties)
- [x] Phase 6 — Fireplace bridge (locked-field reroll UX)
- [x] Phase 7 — Bard's Stage UI (compose + library, Suno-key pending)
- [x] Phase 8 — Final audit (see Audit results below)

## Audit results (2026-06-01)

**Secrets — clean.**
- `git ls-files` for any AK, JWT, key UUID, anthropic prefix: 0 matches.
- `git log -S` for every actual secret value across all history: 0 matches.
- `apps/web/.env.local` and `services/workshop/.env` confirmed gitignored.

**RLS — clean.**
- Workshop's `service_client()` is used in exactly two places, both
  documented: the portrait BackgroundTask pipeline (runs after user
  response, JWT may expire) and the storage-cleanup half of
  `delete_portrait`. Every other route uses `user_client(user.token)`.
- Every new table has RLS enabled and owner-scoped policies.
- Two `SECURITY DEFINER` helpers (`lookup_user_by_email`,
  `lookup_users_by_ids`) are granted only to `authenticated` and are
  narrow.

**Input validation — clean.**
- Every workshop POST/PUT/PATCH body uses a Pydantic `BaseModel`.
- Email body validated by regex; party name length-bounded (1..80).

**Frontend XSS / env hygiene — clean.**
- Zero `dangerouslySetInnerHTML`.
- Zero direct `process.env.*` reads outside `lib/env.ts`.
- Every `<img>` has an `alt` attribute.

**CORS — fixed.**
- Workshop `FRONTEND_ORIGIN` now splits on commas (same pattern as
  ReRoll backend). Set to `https://...vercel.app,http://localhost:3000`
  on Railway to allow both prod and dev.

**A11y — clean.**
- Every interactive element has a focus-visible ring.
- Modal traps focus, restores on close, dismisses on Escape.
- Tooltip is `role="tooltip"` and announced via `aria-describedby`.
- Lock toggle in the Fireplace is `aria-pressed`.
- `prefers-reduced-motion` disables `flicker`, `breath`, `animate-pulse`.

**Voice consistency — clean.**
- Each room follows the voice glossary in DESIGN.md §10.
- All empty states + toasts use tavern-flavoured copy.

## Known outstanding items
- **Suno reseller key** — without it, song generation returns a
  friendly "the bard's lute is unstrung" error.
- **Audio assets** — `useAmbient` + `playSfx` no-op until files exist.
- **Hearth panorama art** — current background is CSS gradients.
- **Lore CRUD** — Bard's "Lore" scope is disabled until we add
  world_lore endpoints.
- **Lookup-by-email enumeration** — accepted tradeoff for the app's
  scope; rate-limiting is a future improvement.
