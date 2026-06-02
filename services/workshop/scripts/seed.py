#!/usr/bin/env python3
"""Seed Tomoi's Tavern with realistic demo data tied to a single user.

Covers every feature except the Bard's Stage:
- ReRoll characters (3 for the main user, 1 for a seeded friend)
- Magic Mirror portraits (one painted via fal.ai per character, mirrored to
  Supabase Storage, marked is_current=true)
- Notice Board: a friendship (accepted) and a 2-member party with hero
  assignments
- World lore: two entries authored by the main user

Idempotent: looks up by sentinel names + emails so re-running does not
duplicate rows. Uses the workshop's existing env vars (SUPABASE keys,
FAL_KEY) — no new credentials.

Usage:
    cd services/workshop && source .venv/bin/activate
    python scripts/seed.py --user-id 36be7994-93f1-4a24-919f-e98dec164a20
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Optional

HERE = Path(__file__).resolve().parent
WORKSHOP_ROOT = HERE.parent
sys.path.insert(0, str(WORKSHOP_ROOT))

import httpx  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv(WORKSHOP_ROOT / ".env")

from app.providers import fal as fal_provider  # noqa: E402
from supabase import create_client  # noqa: E402


SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PORTRAIT_BUCKET = os.environ.get("PORTRAIT_BUCKET", "portraits")

FRIEND_EMAIL = "lyra.tavern.seed@tavern.test"
FRIEND_PASSWORD = "Cinnamon-Apple-Mead-2026"
PARTY_NAME = "The Crooked Crown (seed)"

# --- character templates -----------------------------------------------------
#
# Each template builds a CharacterSheet-shaped JSONB blob. Every entry is the
# `{value, locked, source}` Field convention used by ReRoll's models.
#

def _field(value: Any, source: str = "seed") -> dict[str, Any]:
    return {"value": value, "locked": False, "source": source}


def kael_sheet() -> dict[str, Any]:
    return {
        "name": _field("Kael Stormbreaker (seed)"),
        "race": _field("Half-Elf"),
        "char_class": _field("Cleric"),
        "background": _field("Acolyte"),
        "alignment": _field("Lawful Good"),
        "level": _field(3),
        "stats": _field(
            {"str": 14, "dex": 12, "con": 15, "int": 10, "wis": 16, "cha": 13},
            "Wisdom prioritized for spellcasting; balanced melee build.",
        ),
        "proficiencies": _field(
            [
                "Insight",
                "Religion",
                "Light Armor",
                "Medium Armor",
                "Heavy Armor",
                "Shields",
                "Simple Weapons",
            ],
            "Cleric + Acolyte background grants.",
        ),
        "spells": _field(
            ["Cure Wounds", "Bless", "Sacred Flame", "Light", "Spiritual Weapon"],
            "Mix of healing, support, and a 2nd-level slot.",
        ),
        "equipment": _field(
            [
                "Longsword",
                "Scale Mail",
                "Shield",
                "Holy Symbol",
                "Bedroll",
                "Backpack",
                "Mess Kit",
                "Waterskin",
            ],
            "Cleric acolyte starting kit.",
        ),
        "personality": _field(
            "Compassionate but resolute. Doubts his worthiness, hides it behind a dry wit.",
        ),
        "backstory": _field(
            "Once a temple scribe in Silverspire; a vision drove him into the wilds to right wrongs.",
        ),
    }


def lyra_sheet() -> dict[str, Any]:
    return {
        "name": _field("Lyra of the Vale (seed)"),
        "race": _field("High Elf"),
        "char_class": _field("Wizard"),
        "background": _field("Sage"),
        "alignment": _field("Neutral Good"),
        "level": _field(4),
        "stats": _field(
            {"str": 8, "dex": 14, "con": 13, "int": 17, "wis": 12, "cha": 10},
            "Intelligence-first wizard; modest CON for survivability.",
        ),
        "proficiencies": _field(
            ["Arcana", "History", "Light Armor", "Daggers", "Quarterstaff"],
            "Wizard + Sage background grants.",
        ),
        "spells": _field(
            ["Fire Bolt", "Mage Hand", "Shield", "Magic Missile", "Misty Step", "Web"],
            "Cantrips + 1st/2nd-level spells appropriate to level 4.",
        ),
        "equipment": _field(
            [
                "Quarterstaff",
                "Spellbook",
                "Component Pouch",
                "Scholar's Pack",
                "Bottle of Ink",
            ],
            "Sage scholar with a wizard's tools.",
        ),
        "personality": _field(
            "Curious to a fault. Asks three questions for every one answered.",
        ),
        "backstory": _field(
            "Apprenticed to a half-mad cartographer who claimed the Vale moved when no one watched.",
        ),
    }


def thorin_sheet() -> dict[str, Any]:
    return {
        "name": _field("Thorin Stoutbeard (seed)"),
        "race": _field("Mountain Dwarf"),
        "char_class": _field("Ranger"),
        "background": _field("Outlander"),
        "alignment": _field("Chaotic Good"),
        "level": _field(2),
        "stats": _field(
            {"str": 16, "dex": 15, "con": 14, "int": 10, "wis": 13, "cha": 8},
            "Strength + dex for the front line; mountain dwarf CON bump.",
        ),
        "proficiencies": _field(
            [
                "Athletics",
                "Survival",
                "Light Armor",
                "Medium Armor",
                "Shields",
                "Simple Weapons",
                "Martial Weapons",
            ],
            "Ranger + Outlander background grants.",
        ),
        "spells": _field([], "Level 1-2 ranger has not yet learned spells."),
        "equipment": _field(
            [
                "Longbow",
                "Quiver of Arrows",
                "Handaxe",
                "Studded Leather",
                "Bedroll",
                "Hunting Trap",
            ],
            "Practical wilderness kit.",
        ),
        "personality": _field(
            "Soft-spoken until the trail gets hard. Then he is the loudest person in the woods.",
        ),
        "backstory": _field(
            "Left the mountain hold after a feud over a buried argument. Walks the high passes alone now.",
        ),
    }


def mira_sheet() -> dict[str, Any]:
    return {
        "name": _field("Mira Sundance (seed)"),
        "race": _field("Halfling"),
        "char_class": _field("Bard"),
        "background": _field("Entertainer"),
        "alignment": _field("Chaotic Good"),
        "level": _field(3),
        "stats": _field(
            {"str": 8, "dex": 16, "con": 12, "int": 11, "wis": 13, "cha": 17},
            "Charisma-first bard; nimble.",
        ),
        "proficiencies": _field(
            [
                "Acrobatics",
                "Performance",
                "Light Armor",
                "Simple Weapons",
                "Hand Crossbows",
                "Longswords",
                "Rapiers",
                "Shortswords",
            ],
            "Bard + Entertainer background grants.",
        ),
        "spells": _field(
            ["Vicious Mockery", "Cure Wounds", "Charm Person", "Healing Word"],
            "Cantrips + 1st-level spells appropriate to level 3.",
        ),
        "equipment": _field(
            [
                "Rapier",
                "Lute",
                "Leather Armor",
                "Entertainer's Pack",
                "Costume",
            ],
            "A travelling stage's worth of props.",
        ),
        "personality": _field(
            "Tells the best version of any story, whether or not it's the true one.",
        ),
        "backstory": _field(
            "Walked away from the family circus to chase a singing voice she heard once in a dream.",
        ),
    }


# --- helpers -----------------------------------------------------------------

def supabase():
    return create_client(SUPABASE_URL, SERVICE_KEY)


def _find_user_by_email(sb, email: str) -> Optional[str]:
    """Walk admin.list_users (paginated) and return the matching uuid, if any."""
    needle = email.lower()
    page = 1
    while True:
        listing = sb.auth.admin.list_users(page=page, per_page=200)
        users = getattr(listing, "users", None)
        if users is None and isinstance(listing, list):
            users = listing
        users = users or []
        for u in users:
            u_email = getattr(u, "email", None)
            u_id = getattr(u, "id", None)
            if u_email is None and isinstance(u, dict):
                u_email = u.get("email")
                u_id = u.get("id")
            if u_email and u_email.lower() == needle and u_id:
                return u_id
        if len(users) < 200:
            return None
        page += 1


def ensure_friend_user(sb) -> str:
    """Look up or create the seed-friend auth user. Returns their uuid.

    The Supabase admin API exposes list_users (paginated) and create_user
    (raises on duplicate). We list first to be idempotent; if not found,
    create with email_confirm=True so the seeded account can actually sign
    in.
    """
    existing = _find_user_by_email(sb, FRIEND_EMAIL)
    if existing:
        return existing
    created = sb.auth.admin.create_user(
        {
            "email": FRIEND_EMAIL,
            "password": FRIEND_PASSWORD,
            "email_confirm": True,
        }
    )
    user = getattr(created, "user", None) or created
    uid = getattr(user, "id", None)
    if uid is None and isinstance(user, dict):
        uid = user.get("id")
    if not uid:
        raise RuntimeError(f"Couldn't create the seed friend user: {created!r}")
    return uid


def upsert_character(sb, user_id: str, name: str, sheet: dict[str, Any]) -> str:
    """Insert character if one with this name doesn't already exist for this user."""
    existing = (
        sb.table("characters")
        .select("id")
        .eq("user_id", user_id)
        .eq("name", name)
        .execute()
    )
    if existing.data:
        cid = existing.data[0]["id"]
        # refresh sheet
        sb.table("characters").update({"sheet": sheet}).eq("id", cid).execute()
        return cid
    inserted = (
        sb.table("characters")
        .insert({"user_id": user_id, "name": name, "sheet": sheet})
        .execute()
    )
    return inserted.data[0]["id"]


def ensure_friendship(sb, a: str, b: str) -> None:
    """Either direction OK; if a pair already exists in any direction, mark accepted."""
    existing = (
        sb.table("friendships")
        .select("*")
        .or_(
            f"and(requester_id.eq.{a},addressee_id.eq.{b}),"
            f"and(requester_id.eq.{b},addressee_id.eq.{a})"
        )
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        sb.table("friendships").update({"status": "accepted"}).eq(
            "requester_id", row["requester_id"]
        ).eq("addressee_id", row["addressee_id"]).execute()
        return
    sb.table("friendships").insert(
        {"requester_id": a, "addressee_id": b, "status": "accepted"}
    ).execute()


def ensure_party(sb, owner_id: str, name: str) -> str:
    existing = (
        sb.table("parties")
        .select("id")
        .eq("owner_id", owner_id)
        .eq("name", name)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]
    inserted = (
        sb.table("parties")
        .insert({"owner_id": owner_id, "name": name})
        .execute()
    )
    return inserted.data[0]["id"]


def ensure_party_member(
    sb,
    party_id: str,
    user_id: str,
    character_id: Optional[str],
    role: Optional[str],
) -> None:
    """Insert or update the member row (PK = party_id, user_id)."""
    row = {
        "party_id": party_id,
        "user_id": user_id,
        "character_id": character_id,
        "role": role,
    }
    existing = (
        sb.table("party_members")
        .select("party_id")
        .eq("party_id", party_id)
        .eq("user_id", user_id)
        .execute()
    )
    if existing.data:
        sb.table("party_members").update(row).eq("party_id", party_id).eq(
            "user_id", user_id
        ).execute()
    else:
        sb.table("party_members").insert(row).execute()


def ensure_world_lore(sb, user_id: str, title: str, body: str) -> None:
    existing = (
        sb.table("world_lore")
        .select("id")
        .eq("user_id", user_id)
        .eq("title", title)
        .execute()
    )
    if existing.data:
        return
    sb.table("world_lore").insert(
        {"user_id": user_id, "title": title, "body": body}
    ).execute()


async def ensure_portrait(
    sb,
    user_id: str,
    character_id: str,
    character_name: str,
    sheet: dict[str, Any],
) -> Optional[str]:
    """Paint a portrait if none exists for this character; mark is_current."""
    existing = (
        sb.table("portraits")
        .select("id,image_url,is_current")
        .eq("user_id", user_id)
        .eq("character_id", character_id)
        .execute()
    )
    if existing.data:
        # Make sure at least one is is_current.
        if not any(p["is_current"] for p in existing.data):
            sb.table("portraits").update({"is_current": True}).eq(
                "id", existing.data[0]["id"]
            ).execute()
        return existing.data[0]["image_url"]

    race = (sheet.get("race") or {}).get("value", "")
    klass = (sheet.get("char_class") or {}).get("value", "")
    bg = (sheet.get("background") or {}).get("value", "")
    prompt = (
        f"Portrait of {character_name.replace(' (seed)', '')}, "
        f"a {race} {klass} of {bg} background. "
        "Painterly fantasy oil-painting style, warm tavern lighting, "
        "dramatic shadows, head-and-shoulders composition."
    )
    print(f"  painting {character_name}…")
    pending = (
        sb.table("portraits")
        .insert(
            {
                "user_id": user_id,
                "character_id": character_id,
                "prompt": prompt,
                "model": "fal-ai/flux-pro/v1.1-ultra",
                "status": "pending",
                "stage": "painting",
                "is_current": False,
            }
        )
        .execute()
    )
    portrait_id = pending.data[0]["id"]

    result = await fal_provider.generate_portrait(prompt=prompt, aspect_ratio="3:4")
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(result.image_url)
        resp.raise_for_status()
        blob = resp.content

    path = f"{user_id}/portrait-{portrait_id}.jpg"
    sb.storage.from_(PORTRAIT_BUCKET).upload(
        path=path,
        file=blob,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{PORTRAIT_BUCKET}/{path}"

    # Clear other actives first (defensive), then mark this one current.
    sb.table("portraits").update({"is_current": False}).eq(
        "character_id", character_id
    ).execute()
    sb.table("portraits").update(
        {
            "image_url": public_url,
            "status": "ready",
            "stage": "ready",
            "cost_usd": result.cost_usd,
            "is_current": True,
        }
    ).eq("id", portrait_id).execute()
    return public_url


# --- main --------------------------------------------------------------------

async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--user-id",
        required=True,
        help="Supabase auth.users.id for the main account to seed",
    )
    ap.add_argument(
        "--no-portraits",
        action="store_true",
        help="Skip the fal.ai portrait generation step",
    )
    args = ap.parse_args()
    user_id = args.user_id

    if not SUPABASE_URL or not SERVICE_KEY:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.", file=sys.stderr)
        return 2
    if not args.no_portraits and not os.environ.get("FAL_KEY"):
        print("Missing FAL_KEY in env (use --no-portraits to skip).", file=sys.stderr)
        return 2

    sb = supabase()

    print("=== Seeding Tomoi's Tavern ===")
    print(f"user_id: {user_id}")
    friend_id = ensure_friend_user(sb)
    print(f"friend:  {FRIEND_EMAIL} → {friend_id}")

    # Characters
    print("\n-- characters --")
    sheets_for_main: list[tuple[str, dict[str, Any]]] = [
        ("Kael Stormbreaker (seed)", kael_sheet()),
        ("Lyra of the Vale (seed)", lyra_sheet()),
        ("Thorin Stoutbeard (seed)", thorin_sheet()),
    ]
    main_char_ids: dict[str, str] = {}
    for name, sheet in sheets_for_main:
        cid = upsert_character(sb, user_id, name, sheet)
        main_char_ids[name] = cid
        print(f"  {name}: {cid}")
    friend_char_id = upsert_character(
        sb, friend_id, "Mira Sundance (seed)", mira_sheet()
    )
    print(f"  Mira Sundance (seed) [friend]: {friend_char_id}")

    # Portraits
    print("\n-- portraits --")
    if args.no_portraits:
        print("  skipped (--no-portraits)")
    else:
        for name, cid in main_char_ids.items():
            sheet = next(s for n, s in sheets_for_main if n == name)
            url = await ensure_portrait(sb, user_id, cid, name, sheet)
            print(f"  {name}: {url}")

    # Friends
    print("\n-- friends --")
    ensure_friendship(sb, user_id, friend_id)
    print(f"  accepted: {user_id} <-> {friend_id}")

    # Party + members
    print("\n-- party --")
    party_id = ensure_party(sb, user_id, PARTY_NAME)
    print(f"  party: {PARTY_NAME} → {party_id}")
    ensure_party_member(
        sb,
        party_id,
        user_id,
        main_char_ids["Kael Stormbreaker (seed)"],
        "leader",
    )
    ensure_party_member(sb, party_id, friend_id, friend_char_id, "bard")
    print("  members seated: 2")

    # World lore
    print("\n-- world lore --")
    ensure_world_lore(
        sb,
        user_id,
        "The Burned Harbor",
        (
            "Silverspire's harbor burned for three nights and four days in the autumn"
            " of 1213. No one ever named the cause. The dockmasters' guild swore an"
            " oath of silence; their grandchildren are bound by it still. Travellers"
            " from the south have been known to ask about it once. Never twice."
        ),
    )
    ensure_world_lore(
        sb,
        user_id,
        "The Crooked Crown",
        (
            "A crooked iron crown, set above the tavern hearth. They say it was"
            " given to Tomoi by a wandering king who lost his throne the same week"
            " he won the tavern's largest tab. The crown still leans a little to"
            " the left."
        ),
    )
    print("  2 lore entries.")

    print("\nDone. Open the Round Table and Notice Board to see them.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
