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

Update as we go.

- [x] Phase 0 — Plan + DESIGN.md
- [ ] Phase 1 — Foundation
- [ ] Phase 2 — Tavern scene polish
- [ ] Phase 3 — Magic Mirror delete + responsive
- [ ] Phase 4 — Round Table
- [ ] Phase 5 — Notice Board
- [ ] Phase 6 — Fireplace bridge
- [ ] Phase 7 — Bard's Stage UI
- [ ] Phase 8 — Final audit
