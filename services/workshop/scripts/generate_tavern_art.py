#!/usr/bin/env python3
"""Generate the tavern panorama and write it to apps/web/public/tavern/.

One-shot script. The output is committed to the repo so we never call fal.ai
at runtime — see docs/PLAN.md for the decision. Reuses the workshop's
existing fal provider; no new env vars (just FAL_KEY).

Usage (from services/workshop):
    source .venv/bin/activate
    python scripts/generate_tavern_art.py
    # or:
    python scripts/generate_tavern_art.py --seed 7 --aspect 21:9 --out ../../apps/web/public/tavern/hearth.jpg
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Make `app.*` importable when running from anywhere.
HERE = Path(__file__).resolve().parent
WORKSHOP_ROOT = HERE.parent
sys.path.insert(0, str(WORKSHOP_ROOT))

import httpx
from dotenv import load_dotenv  # noqa: E402  (after sys.path)

# Load the workshop's .env so FAL_KEY is available to fal-client.
load_dotenv(WORKSHOP_ROOT / ".env")

from app.providers import fal as fal_provider  # noqa: E402


REPO_ROOT = WORKSHOP_ROOT.parent.parent
DEFAULT_OUT = REPO_ROOT / "apps" / "web" / "public" / "tavern" / "hearth.jpg"


# A long, anchor-rich prompt. The hotspot percentages in rooms.ts assume
# props are roughly at these positions — keep the description aligned with
# what we'll wire up afterward.
PROMPT = (
    "First-person interior view of a warm, bustling medieval fantasy tavern at "
    "dusk, 21:9 widescreen panorama, oil-painted matte-painting style with "
    "soft brush texture and rich warm lighting. Camera at chest height looking "
    "across the room. "
    # ROOM ANCHORS (the hotspot positions match these placements)
    "DEAD CENTER, slightly back: an enormous stone hearth with a roaring "
    "fireplace, large iron andirons, hanging copper kettle, sparks rising. "
    "LEFT WALL, mid-height: an ornate gilded magic mirror in a curved gold "
    "frame with carved roses. "
    "RIGHT SIDE OF ROOM: a small raised wooden bard's stage with a single "
    "stool, an unattended lute leaning, a velvet curtain backdrop. "
    "FRONT-LEFT FOREGROUND: a heavy round oak table with mugs and a folded "
    "map. "
    "FRONT-RIGHT FOREGROUND: a wooden notice board nailed to a post, weathered "
    "parchment, frayed twine. "
    # WORLD-BUILDING
    "Heavy oak ceiling beams, a wrought-iron chandelier with candles, hanging "
    "tavern banner, polished oak floor planks with iron nails, stone wall "
    "between dark timber. Candle-warm orange, deep amber, rich blood-wood "
    "browns, golden highlights, deep shadow pools. Wisps of pipe smoke in the "
    "air. A few silhouetted patrons seated at side tables, slightly out of "
    "focus, not the subject. No characters in the foreground. No text or "
    "lettering. Painterly, romantic, inviting — Tolkien meets a Studio Ghibli "
    "inn. Cohesive lighting, dramatic shadows, dust motes catching the firelight."
)


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--aspect", default="21:9", help="fal.ai aspect ratio")
    ap.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Output path (created if missing)",
    )
    ap.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional seed (unused by fal-pro/v1.1-ultra wrapper; reserved)",
    )
    args = ap.parse_args()

    if not os.environ.get("FAL_KEY"):
        print(
            "FAL_KEY is not set. Source services/workshop/.env or export it.",
            file=sys.stderr,
        )
        return 2

    print(f"Painting tavern panorama @ {args.aspect}…")
    result = await fal_provider.generate_portrait(
        prompt=PROMPT, aspect_ratio=args.aspect
    )
    print(f"  url:  {result.image_url}")

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(result.image_url)
        resp.raise_for_status()
        blob = resp.content

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(blob)
    kb = len(blob) // 1024
    print(f"Wrote {args.out} ({kb} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
