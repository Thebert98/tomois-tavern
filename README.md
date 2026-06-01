# Tomoi's Tavern

> Step into the tavern. The fire crackles. The mirror waits. The bard tunes their lute.

An interactive, immersive D&D companion app where each AI tool is a "place" inside a living tavern:

- 🔥 **Fireplace** — character generator (powered by [ReRoll](https://github.com/Thebert98/reroll-dnd-character-generator))
- 🪞 **Magic Mirror** — character portrait generator (Flux 1.1 Pro)
- 🎸 **Bard's Stage** — generate songs about feats, parties, or world lore (Suno)
- 📜 **Notice Board** — friends, party invites, party management
- 🪑 **Round Table** — manage characters across all your campaigns

## Architecture

This is a [Turborepo](https://turbo.build/) monorepo.

```
apps/
  web/              Next.js 15 (App Router) — the tavern UI
services/
  workshop/         FastAPI — Magic Mirror + Tavern Bard backend
packages/
  shared/           Shared TypeScript types + Supabase client
  ui/               Shared React components (shadcn/ui)
supabase/
  migrations/       Additive schema (portraits, friendships, parties, bard_songs)
```

ReRoll keeps its own repository and Railway deploy. The tavern's web app calls ReRoll's REST API directly with the user's Supabase JWT — same identity, shared characters.

## Stack

| Layer       | Choice                                              |
|-------------|-----------------------------------------------------|
| Frontend    | Next.js 15 + TypeScript + Tailwind + shadcn/ui      |
| Animation   | Framer Motion · Howler.js for ambient audio         |
| Workshop    | FastAPI + Pydantic                                  |
| Auth + DB   | Supabase (shared with ReRoll: pgvector, RLS, Auth)  |
| Image gen   | fal.ai · Flux 1.1 Pro (portraits, always on)        |
| Sprite gen  | PixelLab · pixflux (JRPG sprites, OPTIONAL)         |
| Music gen   | Suno (via reseller, e.g. sunoapi.com)               |
| Lyrics      | Anthropic Claude Sonnet 4.6                         |
| Storage     | Supabase Storage (portraits, songs)                 |
| Deploy      | Vercel (web) · Railway (workshop)                   |

## Local setup

### 1. Install
```bash
pnpm install
```

### 2. Env
```bash
cp .env.example .env.local           # for Next.js
cp .env.example services/workshop/.env  # for FastAPI
# fill in keys
```

### 3. Workshop (FastAPI)
```bash
cd services/workshop
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### 4. Web (Next.js)
```bash
pnpm dev   # runs apps/web on :3000
```

## Optional features

### Sprites (Magic Mirror)
Portraits always work. Sprites are an optional second pass through PixelLab —
forks that don't want a PixelLab account can leave this off. To enable:

```bash
SPRITES_ENABLED=true
PIXELLAB_API_KEY=pl-...   # https://pixellab.ai
```

When off, the mirror generates the portrait only, the sprite preview hides,
and the party screen falls back to portrait avatars.

## Deployment

- **Web** → Vercel (root `apps/web/`)
- **Workshop** → Railway (root `services/workshop/`)
- **Supabase** — reuse the same project as ReRoll; run new migrations from `supabase/migrations/` in order.

## Attribution

Builds on the System Reference Document 5.1 © Wizards of the Coast, CC-BY-4.0, via the ReRoll backend.
