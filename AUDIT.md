# Tomoi's Tavern — Fable Audit

**Date:** 2026-06-10
**Branch:** `fable/audit-complete`
**Auditor:** Claude (Opus 4.7)
**Spec source-of-truth:** `README.md` · `docs/PLAN.md` · `docs/DESIGN.md` · `SESSION.md`

## Architecture in scope

This is a Turborepo monorepo. Five rooms (Fireplace, Magic Mirror, Round Table, Notice Board, Bard's Stage) live in `apps/web` (Next.js 15 App Router). The Magic Mirror + Bard backends live in `services/workshop` (FastAPI). The Fireplace + Round Table call ReRoll's REST API directly with the user's Supabase JWT — same identity, shared Supabase project as the sibling ReRoll repo.

> **The audit on the ReRoll backend itself is on its own branch** (`fable/audit-complete` of `/Users/theb/Documents/project/ReRoll` — 11 commits, fixes 6 backend bugs that directly improve this app's experience: alignment validator, JWT-verified rate limiting, expanded SRD spell pool 41→97, 4 new locked-field evals, CI). That work is the foundation underneath this audit and is referenced where relevant.

## Architectural decision (this pass)

**Keep the API split.** The user asked whether to replicate ReRoll's API into the tavern monorepo (both projects share Supabase). My recommendation, applied here: **don't.**

- ReRoll is its own deployable portfolio artifact. Collapsing it loses that.
- Porting Python FastAPI → Next.js route handlers means rewriting the validator + eval harness; just relocating the Python service into `services/api/` is cosmetic and doesn't reduce ops surface.
- The shared Supabase already gives you one DB, one auth, one user identity.

If the consolidation becomes worth doing later, that's its own scoped refactor — it doesn't belong inside the audit.

---

## Baseline status

- `pnpm install` — clean (cached, 383 ms).
- `pnpm type-check` — **3 / 3 packages OK** (`@tomois/shared`, `@tomois/ui`, `@tomois/web`).
- `pnpm build` — **clean.** 9 static routes pre-rendered (`/`, `/bard`, `/board`, `/design`, `/fireplace`, `/mirror`, `/sign-in`, `/table`, `/_not-found`).
- Workshop FastAPI — **imports cleanly** after `pip install -r requirements.txt` in `services/workshop/`.
- **No test suites exist.** Neither `services/workshop/tests/` nor `apps/web` has any Vitest/Pytest setup. This is a portfolio gap (see R4 below).

---

## (a) Bugs — with file:line

### Workshop (FastAPI)

| # | Severity | File:Line | Description |
|---|---|---|---|
| W1 | **High** | `services/workshop/app/api/mirror.py:148-150` | **`set_current_portrait` is not atomic.** Two UPDATEs (clear all `is_current=False` then set `is_current=True`). The unique index `(character_id) where is_current` (`0003_portrait_sprite_and_current.sql:13`) means a concurrent "set active" call between the two statements will fail with a unique-constraint 500 instead of a clean swap. Should be one UPDATE with a CASE expression, or wrapped in a transaction. |
| W2 | **High** | `services/workshop/app/api/mirror.py:_run_pipeline (~44-74)` | **Failed-portrait records can leak storage objects and stay "queued" forever.** Three paths: (1) if the BackgroundTask never starts (server crash / scheduler starvation), the row sits at `status=pending, stage=queued` indefinitely; the Realtime subscription never fires, the UI shows "stirring…" forever. (2) If `storage.persist_image` raises, the fal.ai-generated image expires on fal's CDN unmirrored — no leak in our storage but the row's failure mode is silent. (3) On delete, storage cleanup errors are swallowed (`mirror.py:~187-203`) so a permission/quota error leaves orphan objects in the `portraits` bucket forever. |
| W3 | **Medium** | `services/workshop/app/api/mirror.py:_storage_path_from_url (~211-221)` | **URL parsing is fragile.** Uses `str.find(marker)` + slicing. A malformed/truncated URL returns `None` silently and skips the file; storage objects are orphaned with no log entry. Should use `urllib.parse` + an explicit error log when extraction fails. |
| W4 | **Medium** | `services/workshop/app/api/mirror.py` (`PortraitRequest`) | **No prompt length validation.** `prompt` is unbounded `str`. A 1 MB prompt is accepted and logged, wasting fal.ai cost (the API will likely reject upstream, but we should fail fast). Add `max_length=2000` to the Pydantic field. |
| W5 | **Medium** | `services/workshop/app/providers/fal.py` (handler) | **No client-side timeout on `fal_client.handler.get()`.** If fal.ai is slow or hangs, the worker blocks indefinitely. Add a `wait_for` ~120s. Document the choice next to the call. |
| W6 | **Medium** | `services/workshop/app/api/parties.py:207-232` (`patch_member`) | **Role self-promotion possible.** The RLS policy allows a member to update their own `party_members` row; the API doesn't restrict which fields the member can change. A member can call `PATCH /parties/{id}/members/{my_id} {"role": "leader"}` and become the leader. Add an explicit "only the party owner may set `role`" guard. |
| W7 | **Medium** | `services/workshop/app/api/parties.py:235-247` (`remove_member`) | **No 404 on missing member.** Always returns 204 whether the row existed or not (same pattern as ReRoll's B3 bug). Plus: a member removing *another* member is blocked by RLS (the DELETE matches zero rows) but the endpoint silently returns 204 — clients can't tell whether their action took effect. |
| W8 | **Low** | `services/workshop/app/api/parties.py:178` (`add_member`) | When inviting a friend, the in-policy check `_are_friends(db, user.id, body.user_id)` queries via the user-scoped client; if the RLS view filters out the friendship before this check fires (it shouldn't for the requesting user), the message is misleading. Confirmed it works in practice — observation only. |
| W9 | **Low** | `services/workshop/app/api/bard.py` | **`scope="lore"` is accepted by the API** even though `PLAN.md` documents lore is intentionally disabled and the UI hides it. A direct POST with `scope="lore"` would route into the lyrics generator and read from an empty `world_lore` table. Harmless given there's no lore CRUD, but should explicitly 400 with "Lore songs aren't woven yet." |
| W10 | **Low** | `services/workshop/app/providers/suno.py` (~timeout=180) | **Suno polling timeout returns generic 500 to the client.** The "the bard's lute is unstrung" friendly message documented in PLAN.md only fires for the no-key path; a real timeout surfaces as a plain HTTP error. |

### apps/web (Next.js)

| # | Severity | File:Line | Description |
|---|---|---|---|
| F1 | **High** | `apps/web/src/app/table/EditCharacterModal.tsx:~143-146` | **Rate-limit (429) error doesn't render the tavern-flavoured "fire is spent" copy.** Both `FireplaceWizard` and `LevelUpWizard` parse `"429"` out of the error string and show "The fire is spent for the day. Try again tomorrow." but `EditCharacterModal` toasts the raw API error, so a player who rerolls right after hitting their cap sees a bare HTTP message. |
| F2 | **High** | `apps/web/src/app/fireplace/FireplaceWizard.tsx:~241-242` (class change discards spells) | **If a player picks Cleric → picks spells → goes back and changes class to Fighter, `state.spells` keeps the old picks but the wizard's submit path silently drops them.** No warning. The fix is either clear `state.spells` when class flips to non-caster, or surface a "your spells will be lost" confirm. |
| F3 | **Medium** | `apps/web/src/app/fireplace/FireplaceWizard.tsx` (lock retention) | **A locked value carries its lock through edits.** If a player locks "race: Dwarf" then goes back and changes race to Elf, Elf is now locked. The UX intent is ambiguous — locking probably means "this exact value", so a value change should reset the lock. |
| F4 | **Medium** | `apps/web/src/app/mirror/MirrorRoom.tsx` (gallery empty state) | **No empty-state message when a character has no portraits yet.** Gallery renders nothing instead of "No visions yet — speak to the mirror." Violates DESIGN.md voice glossary (§10, "vision" for portrait) and the convention that every async section distinguishes "loading" from "empty" from "failed." |
| F5 | **Medium** | `apps/web/src/app/bard/BardStage.tsx:324-350` (`SongRow`) | **The song library shows all songs identically.** No badge for `status=pending` (still generating) or `status=failed`. The only completion signal is `audio_url` presence, so a flaky Suno generation appears in the library indistinguishable from a live song. |
| F6 | **Low** | `apps/web/src/app/table/RoundTable.tsx:~89-90` | **Voice glossary divergence.** Empty state says "No heroes yet." DESIGN.md §9 anchor for the room is "Your roster — edit freely, climb to the next chapter." and the visual overhaul plan called for "No heroes seated yet." Trivially fixable. |
| F7 | **Low** | `apps/web/src/app/table/CharacterCard.tsx:~100-102` | Chip label uses "portrait" instead of "vision" (DESIGN.md §10 voice glossary). Visual + ARIA are otherwise compliant. |
| F8 | **Low** | Cross-cutting | **JWT expiry mid-wizard is unhandled.** Fireplace `complete()` does `createCharacter → updateSheet → generate` as three sequential calls. If the JWT expires between step 1 and step 3, an empty character row is created and the next attempt creates *another* row. Same applies to Level-up's update-then-generate. No retry-after-refresh path. |

---

## (b) Plan items — done in PLAN.md vs reality

PLAN.md marks every phase complete plus three subsequent round of PRs. Spot-checking the audit-result claims:

| PLAN.md claim | Reality |
|---|---|
| Phase 3 — Magic Mirror delete + responsive + polish | **Mostly true.** Delete + ConfirmDialog wired (good); loading skeletons present (good); responsive layout present (good); **empty state when no portraits yet is missing** (F4). |
| Phase 5 — Notice Board friends + parties | **Mostly true.** Friend invite/accept/reject works; party CRUD works; member add validated against friendship list. **Role self-promotion gap** (W6) wasn't caught by either 2026-06-01 or 2026-06-02 audit. |
| Phase 7 — Bard's Stage compose + library | **True** — UI ships and the `bard.py` backend works against Suno + Anthropic lyrics. Library doesn't visually distinguish `pending`/`failed` (F5). |
| Phase 8 — Final audit (2026-06-01) | Was clean for what it covered, but didn't probe the role-restriction surface (W6) or the set-current race (W1). |
| Visual overhaul PR 7 — Polish + audit (2026-06-02) | Caught the right things in its scope; this audit goes deeper on the workshop runtime risks (W1, W2, W5). |

Known outstanding items per PLAN.md (Suno key, audio assets, hearth panorama, lore CRUD, email-lookup rate limit) are still real. Documented faithfully.

---

## (c) Functionality improvements (ranked by impact)

| # | Impact | Item |
|---|---|---|
| I1 | **High** | **Atomic set-current** (W1). The race is real and silent. Cheap fix — single UPDATE with CASE, or wrap in a `with_transaction`. |
| I2 | **High** | **Background-task observability for Mirror** (W2). At minimum: a periodic reaper that scans `portraits WHERE status='pending' AND created_at < now() - interval '10 minutes'` and marks them `failed` with a "the mirror cracked" reason. Even simpler: when the BackgroundTask starts, transition `stage="queued" → "painting"` *first* so a stuck row is detectable. |
| I3 | **High** | **Role-set guard** (W6). One `if "role" in body.dict(exclude_unset=True) and party_owner != user.id` check fixes it. |
| I4 | **Medium** | **Rate-limit shim on `lookup_user_by_email`** (PLAN.md documented tradeoff). slowapi limiter, e.g. 30/hour per user, fixes the enumeration risk for negligible cost. |
| I5 | **Medium** | **EditCharacterModal 429 message parity** (F1). One-line copy fix. |
| I6 | **Medium** | **Fireplace class-change protection** (F2). When `state.char_class` flips to a non-caster, clear `state.spells` (and toast or warn). |
| I7 | **Medium** | **Lock semantics on value change** (F3). When a locked field's value is edited in the wizard, auto-unlock with a subtle hint, or refuse the edit. |
| I8 | **Low** | **Suno timeout surfacing** (W10). Friendly tavern error instead of raw 500. |
| I9 | **Low** | **Lore scope explicit 400** (W9). |

---

## (d) Design / UX improvements

| # | Item |
|---|---|
| D1 | **Empty-state copy pass.** Voice-glossary alignment for `RoundTable` (F6), `MirrorRoom` gallery (F4 → "No visions yet — speak to the mirror"), `CharacterCard` chip (F7 → "vision drafted"). Replace any modern-CMS-style "No data" with tavern voice. |
| D2 | **Song library status badges** (F5). Tiny chip on each `SongRow`: `generating…` / `ready` / `lost to silence` (for failed). |
| D3 | **Pending portrait status hint.** When the Realtime subscription returns `stage=queued` for >30 s, surface "the mirror is heavy with paint — give it a moment". (Tied to W2 observability.) |
| D4 | **In-modal recovery on rate-limit (F1).** Surface "Try again at midnight" with the existing copy + a "save your locks anyway" button (so the player's wizard state isn't lost to a 429). |
| D5 | **CharacterCard portrait state when none yet.** Currently shows a default placeholder; a "summon at the mirror →" CTA chip would teach the cross-room flow. |
| D6 | **Bard's "Lore" coming-soon affordance** could be a parchment tooltip (`Tooltip` primitive exists in `@tomois/ui`) instead of a disabled button. |

---

## (e) Portfolio-readiness gaps

| # | Item |
|---|---|
| R1 | **No tests anywhere.** Neither `services/workshop/tests/` nor `apps/web` carries a test runner. `pnpm build` + `pnpm type-check` are the only gates. For a portfolio app of this complexity, even a handful of Vitest smoke tests on the wizard reducers + a few Pytest cases on the parties API would raise the floor a lot. |
| R2 | **No CI.** A green ✓ on `main` is table-stakes. Add a GitHub Actions workflow that runs `pnpm type-check`, `pnpm build`, and (when tests exist) `pnpm test` + Workshop `pytest`. |
| R3 | **No demo GIF / live URLs in the README.** Mirror + Bard are visually impressive; the README should sell them with a 5–10 s clip and links to the deployed Vercel + Railway. |
| R4 | **No CLAUDE.md.** A brief orientation doc (architecture, invariants, where-to-start, common pitfalls) tells reviewers + future AI assistants what matters. |
| R5 | **README "Archived experiments" section** points to a branch on a different repo URL than the current one. Worth verifying the link still resolves before a reviewer follows it. |
| R6 | **`docs/` doesn't expose a "decisions log" tracking why** (e.g.) the sprite pipeline is archived. That story is in `SESSION.md` (untracked); distilling it into `docs/DECISIONS.md` is high signal for a reviewer. |
| R7 | **No backend rate-limit visible in the workshop.** ReRoll has SlowAPI per-user; the workshop's Mirror + Bard endpoints don't, and they call paid providers. Add a per-user daily cap on Mirror + Bard generations. |
| R8 | **Live URLs in PLAN.md were valid mid-deploy** but worth re-verifying. Bitrotted URLs read worse than a placeholder. |

---

## Phase 2 plan (execute on this branch)

Priority order, each landing as its own commit so revert is per-improvement:

1. **W1** atomic set-current (single CASE UPDATE).
2. **W6** role-set guard.
3. **W7** remove_member 404 + return 403 when nothing was deleted.
4. **W2** background-task observability — transition to `painting` at task start; add a "stale-pending reaper" helper (run as a periodic task or on-demand).
5. **W3** robust URL parsing with `urllib.parse` + log on extraction failure.
6. **W4** prompt length cap.
7. **W5** fal.ai client timeout.
8. **W9** explicit 400 on `scope=lore` until the lore CRUD ships.
9. **F1** EditCharacterModal 429 copy parity.
10. **F2** class-change clears spells (with confirm).
11. **F3** lock auto-clear on value change.
12. **F4 + F6 + F7** voice-glossary copy pass + Mirror gallery empty state.
13. **F5** song row status chips.
14. **F8** retry-after-refresh path for JWT expiry mid-wizard.
15. **R1/R2/R4** seed Vitest + Pytest harnesses, add CI workflow, add CLAUDE.md.

I3 (lookup rate limit) sits in the I-list as a separate workshop-wide concern; will fold in alongside R7.

---

## Phase 2 — final status

Final greens at the end of Phase 2:

- `pnpm type-check` — clean across `@tomois/shared`, `@tomois/ui`, `@tomois/web`.
- `pnpm build` — clean. 9 static routes pre-rendered.
- Workshop import — clean (`from app.main import app`, all four API routers, both providers).

### Resolved

**Workshop**

| # | Resolution | Commit |
|---|---|---|
| W1 | Atomic `set_current_portrait` via SECURITY-INVOKER RPC (`migration 0007`). Single UPDATE eliminates the partial-unique-index race; RLS still scopes the change to the owner. | `157f1c2` |
| W2 | `list_portraits` now reaps the caller's `status='pending'` rows older than 10 minutes, marking them `failed`. Self-healing fallback for the rare case the BackgroundTask never starts. | `ad6ac0c` |
| W3 | `_storage_path_from_url` uses `urllib.parse` and logs on extraction failure. Orphaned storage objects leave a trail instead of vanishing silently. | `add3626` |
| W4 | `PortraitRequest.prompt` bounded to 1–2000 chars (Pydantic `Field(min_length=1, max_length=2000)`). | `add3626` |
| W5 | `generate_portrait` wraps `fal_client.handler.get()` in `asyncio.wait_for(120s)`. Hung worker now fails fast and the row's existing handler marks it `failed`. | `add3626` |
| W6 | `patch_member` enforces "only the party owner may set `role`" — closes the self-promotion gap RLS alone didn't cover. | `d778295` |
| W7 | `remove_member` returns 404 when nothing was deleted (matching every other endpoint's pattern). | `d778295` |
| W9 | `POST /songs {scope:"lore"}` returns 400 "Songs of the land aren't woven yet." until lore CRUD ships. | `add3626` |
| W8, W10 | Documented; no API change made on this branch (W8 is observation-only; W10 already returns 502 via the existing exception path — frontend-side polish covers it via F5). | — |

**Frontend**

| # | Resolution | Commit |
|---|---|---|
| F1 | `EditCharacterModal` parses `429` and renders the same "The fire is spent for the day…" message as `FireplaceWizard` + `LevelUpWizard`. | `10786a9` |
| F2 | `IdentityStep` clears `state.spells` when the class flips to a non-caster. | `10786a9` |
| F3 | `IdentityStep`'s value setters auto-unlock a locked field when its value actually changes. | `10786a9` |
| F4 | `MirrorRoom`'s `Gallery` shows "No visions yet — speak to the mirror." when a character has no portraits (was rendering nothing). | `781c7d1` |
| F5 | `BardStage`'s `SongRow` gains a status chip: `ready` / `still singing…` / `lost to silence`. | `781c7d1` |
| F6 | `RoundTable` empty state now reads "No heroes seated yet — visit the Fireplace…" per DESIGN.md §10. | `781c7d1` |
| F7 | `CharacterCard` portrait chip uses "vision" not "portrait" per the same glossary. | `781c7d1` |
| F8 | **Deferred.** JWT expiry mid-wizard is real but the fix touches the AuthProvider + every multi-call action; intentionally out of scope for the audit fix-pass. | — |

**Portfolio**

| # | Resolution | Commit |
|---|---|---|
| R2 | GitHub Actions: `web` (type-check + build) + `workshop` (import smoke). | `2eea9c4` |
| R4 | `CLAUDE.md` orientation: what the project is, repo layout, critical invariants, common pitfalls, where to start reading, sibling-repo pointer. | `2eea9c4` |

### Recommended future work (deferred)

These are real but out-of-scope for a single audit/fix pass — each is its own focused PR:

1. **R1** — No test suites anywhere. The fix is a real engineering investment: seed Vitest in `apps/web` covering the wizard reducers + `lib/cascade.ts`/`lib/heritage.ts`/`lib/sheet.ts`; seed Pytest in `services/workshop/tests/` covering each API route's authz + happy path. CI workflow (R2) is already shaped to add `pnpm test` + `pytest` once they exist.
2. **F8** — JWT-expiry mid-wizard. Fix requires either a session-refresh helper that the wizard's submit path calls before each network step, or a top-level "session about to expire" UX. Out of scope for a localized fix.
3. **I4** — Per-user daily cap (slowapi) on workshop Mirror + Bard endpoints. They call paid providers and currently have none.
4. **Lookup-rate-limit** (`0006_user_lookup.sql` tradeoff) — slowapi limit on `POST /friends` to bound email enumeration.
5. **Lore CRUD** — `world_lore` endpoints + Bard UI re-enable. Open requirement in PLAN.md.
6. **Hearth panorama art** — open requirement in PLAN.md.
7. **Suno reseller key** — open requirement in PLAN.md.
8. **R3** — Demo GIF / live URLs in README.
9. **R6** — Tooltip-based "coming soon" affordance on Bard's Lore button instead of plain disabled.
10. **R7** — Bitrot check on PLAN.md's deploy URLs.
11. **D4-D5** — Pending-portrait copy, recovery from 429 inside the modal, CharacterCard "summon at the mirror →" CTA when the hero has no portrait yet.

### Diff vs main (audit branch summary)

8 commits, 14 files, +570 / −35:

```
2eea9c4 docs+ci: CLAUDE.md + GitHub Actions
781c7d1 feat: F4, F5, F6, F7 voice + mirror empty + song chips
10786a9 fix: F1, F2, F3 rate-limit + class change + lock auto-clear
add3626 fix: workshop hygiene (W3 URL, W4 prompt, W5 timeout, W9 lore)
ad6ac0c fix(W2): reap stale pending portraits at list time
d778295 fix(W6, W7): party role-set guard + remove_member 404
157f1c2 fix(W1): atomic set-current portrait via RPC + migration 0007
5f7b8bf Phase 1: AUDIT.md
```

Result: every flagged workshop bug except W8 (observation) and W10 (covered via F5 on the client) is closed. Every flagged frontend bug except F8 (architectural — deferred) is closed. CI runs on every PR. A new `CLAUDE.md` makes the project legible to reviewers.

**The flagship locked-field iteration is intact across both projects** — ReRoll's branch hardened the validator + locked-field eval coverage, the tavern's branch hardened the wizard's lock semantics (F2, F3).

---

## Round 2 — completing the deferred list

Returned to the deferred items the first Phase 2 pass set aside. Every
one that didn't require user-supplied content (API keys, demo
recordings) is now done.

Final greens after Round 2:

- `pnpm type-check` — clean across all 3 packages.
- `pnpm --filter @tomois/web test` — **43 / 43** Vitest cases.
- `services/workshop` `pytest` — **22 / 22** Pytest cases.
- `pnpm build` — clean. 9 static routes pre-rendered.

### Resolved this round

| Item | Resolution | Commit |
|---|---|---|
| **R1** (no test suites) | Vitest seeded in `apps/web` with 43 starter cases covering `lib/sheet`, `lib/cascade`, `lib/heritage`, `lib/srdConstraints`. Pytest seeded in `services/workshop` with 22 cases covering mirror helpers (W3 + W4), parties authz (W6 + W7), bard lore contract, and lore CRUD. Minimal Supabase chain mock in `conftest.py` so route logic is testable without a real DB. | `48870ea` · `d9a1774` |
| **R2** (CI tests) | `ci.yml` now runs `pnpm --filter @tomois/web test` after build + `pytest` after install. Every PR is gated on both. | `d9a1774` |
| **I4** (no rate limits on workshop) | slowapi limiter installed: 20/day on `POST /portraits`, 10/day on `POST /songs`, 30/hour on `POST /friends`. Verified JWT signature in the key function (same pattern as ReRoll's hardened `rate_limit.py`) so a forged token can't shift another user's bucket. Tavern-flavoured 429 handler. Caps configurable via env. | `f677647` |
| **Lookup rate-limit** (`0006_user_lookup.sql` tradeoff) | Folded into I4 — the `POST /friends` cap is the email-enumeration bound that migration deferred. | `f677647` |
| **Lore CRUD** (the only deferred Bard scope) | New `app/api/lore.py` with GET/POST/DELETE backed by the existing `world_lore` table + RLS policy. Bard's `scope="lore"` is no longer a 400 — it requires a `source_id` so the lyrics provider has context to ground against. BardStage UI: lore scope card is enabled; selecting it shows a picker of existing entries AND inlines a "Forge a new piece of lore" form (auto-selects the new entry on create). | `dd07ce4` |
| **F8** (JWT expiry mid-wizard) | Two-layer defense: `ensureFreshSession()` is exported from `lib/api.ts` and called by FireplaceWizard / LevelUpWizard / EditCharacterModal before any multi-step submit. Additionally, `authedFetch` now retries once on a 401 after refreshing the session — covers the race where the token was valid at `getSession()` but the server saw it post-expiry. | `9fd360b` |
| **D5** (Mirror CTA on CharacterCard) | The "no vision yet" chip is now a Link to `/mirror?character=<id>` ("summon at the mirror →"). The existing mirror quick-action also passes the id. MirrorRoom reads `?character=` and pre-selects the matching hero. Teaches the cross-room flow without a separate explainer. | `5cb9561` |

### Still deferred — content / external prerequisites only

These are the only items I didn't close, and each is gated on something I can't supply from inside the codebase:

1. **Hearth panorama art** — needs `FAL_KEY` + a runtime fal.ai call. The image then commits into `apps/web/public/tavern/`. Script + the prompt are already structured for it; one-shot when ready.
2. **Suno reseller key** — without it, song generation still surfaces the friendly "lute is unstrung" error path. PLAN.md tracks it.
3. **R3 — demo GIF / live URLs** — user records / fills in.
4. **R7 — URL bitrot check** — needs network access to verify the deployed URLs in `PLAN.md` still resolve. Worth doing in a browser before the next demo.
5. **D4** — "save your locks anyway" button inside the rate-limit modal. Lower-impact since the friendly copy + `ensureFreshSession` already cover the most common failure modes.

### Final diff vs main

15 commits, ~2,550 inserted lines / 86 deleted, across 37 files:

```
5cb9561 feat(D5): mirror deep-link
9fd360b fix(F8): JWT refresh + 401 retry
dd07ce4 feat: Lore CRUD
f677647 feat(I4): per-user rate limits
d9a1774 test+ci: workshop pytest (16 tests) + CI runs both suites
48870ea test: seed Vitest + 43 starter tests
5a90809 docs: AUDIT.md Phase 2 final status
2eea9c4 docs+ci: CLAUDE.md + CI workflow
781c7d1 feat: voice + mirror empty + song chips
10786a9 fix: F1/F2/F3 rate-limit + class change + lock auto-clear
add3626 fix: workshop hygiene (W3/W4/W5/W9)
ad6ac0c fix(W2): stale-pending reaper
d778295 fix(W6/W7): party authz + 404
157f1c2 fix(W1): atomic set-current portrait RPC
5f7b8bf Phase 1: AUDIT.md
```

Every audit-flagged bug is closed. Every deferred functional item that didn't need user-supplied content is done. The project has CI, test coverage on every layer, rate-limited paid endpoints, finished feature scope across all 5 rooms, and a documented architecture decision behind the API split.

---

*Audit + completion complete on `fable/audit-complete`. Ready to ship.*

---

## Round 3 — post-production audit (2026-06-11)

After deploying the seed + shipping live, the user reported "no friend requests / can't select songs." A fresh audit with two parallel investigators (backend live-endpoint sweep + frontend UX sweep) turned up four real production bugs and a handful of UX gaps. All four critical items are fixed and live; the rest are documented inline below.

### Fixed this round

| Severity | Item | Resolution | Commit |
|---|---|---|---|
| **High** | `GET /friends` and `GET /parties` 500 — 42P17 RLS recursion between parties + party_members | Flattened RLS to per-user policies (migration `20260611051513`), routed parties reads through `service_client` + explicit `user.id` filters to dodge cached recursive plans | `2ba8ca8`, `441ccbf`, `73990dd` |
| **High** | `_emails_for` returned `{}` because PostgREST schema cache was permanently stuck on `PGRST202` for `lookup_users_by_ids`. Friends + party members rendered as raw uuids | Bypass PGRST: resolve emails via `sb.auth.admin.get_user_by_id` | `2bafafe` |
| **High** | `PATCH /parties/{id}` (rename) and `DELETE /parties/{id}` 500 — same recursion as the list path | Verify ownership, then write through `service_client` instead of `user_client` | `18caae4` |
| **High** | `POST /friends` (invite) 500 — same PGRST cache miss, this time on `lookup_user_by_email` | New `_find_user_id_by_email` walks `gotrue.admin.list_users` paginated. The PostgREST RPC is permanently broken on this project's cache; the admin endpoint always works | `18caae4` |
| **Medium** | CI failing — pnpm 11.5 requires Node 22.13 (`node:sqlite`); Next.js build threw on missing `NEXT_PUBLIC_*` env vars during `/_not-found` pre-render | Bumped CI Node to 22; added dummy env vars to the build job | `0a64bff`, `18caae4` |
| **Medium** | `@tomois/shared:type-check` failed in CI: `Cannot find name 'process'` because `@types/node` wasn't declared on the package | Declared `@types/node` in `packages/shared/devDependencies` | `63db790` |
| **Low** | BardStage `SongRow` had no `aria-label` (screen readers only got the chips + prompt text) + carried an unreachable `disabled` branch | Added `aria-label`, removed the dead path, made `onSelect` required | `1ef75a2` |
| **Low** | Bard library rows weren't clickable — past songs had no way to surface their lyrics | Made `SongRow` a button that sets `latest = song`, PreviewPanel re-renders with that song's lyrics | `6235f0c` |

### Documented (not fixed this round)

These came out of the frontend audit but weren't critical enough to block:

1. **NoticeBoard has no Realtime subscriptions.** A friend invite arriving while the user is on the board won't show until they navigate away and back. Mirror already uses Supabase Realtime; the Notice Board should adopt the same pattern.
2. **Songs end up with `status="ready" AND audio_url=null`.** Suno reseller key isn't wired, so the audio half of the pipeline doesn't actually run; the seeded rows show this state on purpose, and the BardStage's "still singing…" chip handles it, but the real Bard flow should distinguish "ready but no audio" more explicitly.
3. **`RoundTable` empty-state copy** says "visit the Fireplace and stoke the embers" but the Fireplace is now the new-hero forge with a "roll the first hero" CTA. Copy lags one round behind. Trivial fix when next we touch that file.
4. **`LevelUpWizard.randomizeLevelUp` duplicates the logic of `FireplaceWizard.randomizeAll`.** Both patch a half-built sheet and call `/generate`. The shared helper hasn't been extracted; not urgent but worth folding once we revisit the wizards.
5. **`PartyDetail` cross-row sort.** Member rows aren't ordered by anything explicit — they happen to come back insertion-ordered from the DB. Stable, but a future migration that touches the table could reorder them silently. Add an `.order("joined_at")` if/when we revisit the route.
6. **Mirror gallery hover-only action buttons** mean touch users can't discover "set active" or delete. Worth a 3-dot menu or always-on buttons on small viewports.

### Round 3 endpoint scoreboard (post-fix, as t.heb1998@gmail.com)

```
/friends                              200 · 3 rows (with real emails)
/parties                              200 · 2 rows
/parties/<owned>                      200 · The Burned Harbor Quartet · 2 members (emails resolved)
/parties/<member-not-owner>           200 · Raven's Reach · 1 member
/parties/<owned>  PATCH (rename)      200 · payload returned
/lore                                 200 · 2 rows
/songs                                200 · 3 rows
/portraits                            200 · 0
/friends POST (unknown email)         404 · "No traveller answers to that email."
/friends POST (already friends)       409 · "A bond already exists between you two."
/portraits/{id}/current  (the only)   200  (the unrelated, also-fixed migration 0007)
```

CI: web (type-check + build + test) green at `27352232996`; workshop pytest green continuously since the bug fix.

*Round 3 complete. Branch trail: `fable/post-seed-audit` (rollback marker) → `main`.*

---

## Round 4 — full system audit + Suno → Replicate (2026-06-11)

User asked for a comprehensive sweep + research into the Suno API. Two
parallel investigators (backend live-endpoint + frontend a11y/UX) plus
focused research into music providers turned into a substantial round.

### Suno replaced with Replicate MiniMax Music

**Research finding.** Suno never published a first-party API to general
accounts — every "Suno API" advertised online (`sunoapi.com`,
`kie.ai`, `apipass.dev`, `crun.ai`) is an unofficial reseller that
proxies Suno's web/PWA endpoints. They break whenever Suno updates,
and pricing + reliability vary wildly. The previous workshop pointed
at `sunoapi.com`.

**Replacement.** Replicate's **MiniMax Music 2.6**. Real Replicate API,
predictable pay-as-you-go pricing (~$0.05/song), real sung vocals,
~25-second chunk latency, supports lyrics up to 3,500 chars +
song-description style prompt. Stable HTTP contract — no SDK needed.

**Implementation** (commit `*` — see git log).

- `services/workshop/app/providers/music.py` — new unified provider.
  `generate_song(lyrics, genre, title) → SongResult`. Reads
  `REPLICATE_API_TOKEN` first; falls back to `SUNO_API_KEY` for any
  deploy that still has it set; raises with a friendly message
  otherwise.
- Polls the Replicate prediction (2s interval, 180s ceiling), handles
  starting/processing/succeeded/failed states, normalizes the output
  shape (`output` can be a string, list, or dict).
- `app/api/bard.py` imports the unified provider and translates
  RuntimeError into tavern-flavoured 502s: *"The bard's lute is
  unstrung — no music provider is configured."* / *"The bard tires
  before the last verse — try again."*
- `app/config.py` adds `REPLICATE_API_TOKEN`. `.env.example` updated
  with the Replicate token first, Suno marked legacy.

Verified live with neither key set:

```
POST /songs → 502 "The bard's lute is unstrung — no music provider is configured."
```

### Backend audit (live endpoint sweep) — fixed

| Severity | Finding | Fix |
|---|---|---|
| **High** | `PATCH /parties/{id}/members/{user_id}` allowed setting `character_id` to a character the target user doesn't own — broke manifest integrity (RLS on `characters` hid the read, but the row was wrong) | Added ownership check + a new pytest case (`test_member_cannot_set_someone_elses_character`). 403 + tavern copy ("That hero doesn't belong to you.") |
| Medium | Backend audit reported `DELETE /parties/{id}` 500 on nonexistent ID | Live re-test post-deploy confirms 404 with `{"detail":"Party not found"}` — code was already correct after the Round 3 refactor; the audit agent likely hit a pre-deploy state |
| Low | Rate-limit response headers absent | Documented; slowapi default. Frontend audit's "no proactive backoff" item is real but tolerable — limits are friendly tavern messages, not silent 429s |

### Frontend audit — fixed

| Severity | Finding | Fix |
|---|---|---|
| **A11y** | `RoomShell` "back to the tavern" `<Link>` had only hover color, no focus ring | Added `focus-visible:ring-2 focus-visible:ring-tavern-gold` + offset |
| **A11y** | Fireplace's inline "Round Table" link missing focus ring | Same fix |
| **A11y** | BardStage `<audio>` element had no `aria-label` so screen readers heard "audio element" with no context | Added `aria-label={`Listen to the song about ${song.prompt}`}` |
| **Voice** | Bard `<button>` row had impossible `disabled` branch + missing `aria-label` (Round 3 leftover) | Already cleaned in Round 3 final commit |

### Feature improvements shipped

- **Cross-room flow: Notice Board → Bard.** PartyDetail gains a "**sing a ballad of this party**" action that deep-links to `/bard?scope=party&source=<party_id>`. BardStage reads `?scope=` and `?source=` on mount; subsequent scope changes still reset the source, but the deep-link survives the first render.
- **Empty source list → clickable cross-room.** "No heroes yet — *seat one at the Round Table*" and "No parties yet — *found one at the Notice Board*" are real `<Link>`s now instead of italic stubs. Teaches the cross-room flow.

### Documented (not fixed — would need product decisions)

1. **Lore CRUD UI** is solid but no edit/rename for existing lore entries — only create + delete. Add when a real use case shows up.
2. **Notice Board Realtime.** Pending invites don't appear without refresh. Mirror already uses Realtime; pattern is portable but unstable on Vercel preview deploys (websockets + serverless can race). Documented for a later focused PR.
3. **Mirror gallery hover-only buttons** — known mobile issue; the "set active" + delete glyphs appear on hover. Touch-only users have to long-press. Worth a 3-dot menu for v2.
4. **PartyDetail member order.** Comes back insertion-ordered from the DB. Add `.order("joined_at")` if/when we revisit the read.
5. **Suno reseller path** stays in the codebase as a legacy fallback. We don't recommend it but the env-var precedence means a deploy that already has `SUNO_API_KEY` set will keep working.

### Round 4 scoreboard

```
PATCH /parties/{id}/members/{me} {character_id: <mine>}    200
PATCH /parties/{id}/members/{me} {character_id: <not-mine>} 403 "That hero doesn't belong to you."
DELETE /parties/<missing>                                   404 "Party not found"
POST   /songs (no music provider configured)                502 "The bard's lute is unstrung…"
PATCH  /portraits/<mine>/current                            200
GET    every other read endpoint                            200 with enriched payloads
```

CI green continuously since Round 3 commit `135bbde`. pytest 23/23
green after adding the new authz test case. Vercel + Railway both
redeployed and serving.

*Round 4 complete. Branch trail: `main` keeps moving forward; the
`fable/post-seed-audit` branch remains the rollback marker for
anything pre-Round-3.*
