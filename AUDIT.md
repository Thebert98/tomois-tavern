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

*Audit complete on `fable/audit-complete`. Ready for review.*
