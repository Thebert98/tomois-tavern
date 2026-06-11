"""Seed Tomoi's Tavern with a demo account that demonstrates every room.

Run from ``services/workshop`` with the venv activated and the workshop's
``.env`` loaded — it reads ``SUPABASE_URL``, ``SUPABASE_SERVICE_ROLE_KEY``
and, optionally, ``FAL_KEY`` (for one real portrait generation).

What this seeds, idempotently — re-running scrubs the prior seed first so
the demo state stays stable:

  * 2 demo users (the primary traveller + a friend named the raven).
  * 5 SRD-valid characters covering 5 classes and 5 races.
  * 2 world-lore entries the Bard's Stage can sing about.
  * 1 accepted friendship between the two users.
  * 1 party owned by the primary, with both users seated.
  * 1 real portrait (calls fal.ai if ``FAL_KEY`` is set; else skips).
  * 2 pre-composed song rows with lyrics — ``audio_url`` is left null
    because Suno's reseller key isn't wired yet, but the BardStage
    library renders the rows with the "still singing…" / "ready" chip
    so the UX is demonstrable.

After it runs, sign in to the deployed web app with the credentials it
prints at the end and you'll see every room populated.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path
from typing import Any

# Make ``import app.*`` work when the script is run from anywhere.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load .env so SUPABASE_URL / SERVICE_ROLE / FAL_KEY are picked up the same
# way the FastAPI app picks them up. pydantic-settings would parse the file
# during ``from app.config import settings`` too, but reading explicitly
# here lets the script work even if the workshop module imports fail.
def _load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env(ROOT / ".env")

from supabase import create_client  # noqa: E402

SB_URL = os.environ["SUPABASE_URL"]
SB_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@tomois.tavern")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo-tavern-2026")

# Companion users used to populate friendships + party invites. Passwords
# are unused outside this script (these users don't sign in for the demo).
COMPANION_USERS = [
    ("raven@tomois.tavern", "raven-tavern-2026", "the raven"),
    ("aldwin@tomois.tavern", "aldwin-tavern-2026", "Aldwin"),
    ("brenna@tomois.tavern", "brenna-tavern-2026", "Brenna"),
    ("calder@tomois.tavern", "calder-tavern-2026", "Calder"),
]


# ----------------------------------------------------------------------
# The cast — five characters with rich, validator-clean SRD sheets.
# Race + class + level + alignment + stats + spells + proficiencies are
# all set so the Round Table cards have something to display and the
# Bard has feats to sing about.
# ----------------------------------------------------------------------

def _wrap(value: Any, *, locked: bool = True, source: str | None = "demo seed") -> dict:
    return {"value": value, "locked": locked, "source": source}


CHARACTERS: list[dict[str, Any]] = [
    {
        "name": "Aerith Lightbringer",
        "summary": "A Hill Dwarf Cleric who keeps the harbor's last lamp lit.",
        "portrait_prompt": (
            "Portrait of Aerith Lightbringer, a Hill Dwarf Cleric, late thirties, "
            "warm amber eyes, braided auburn hair shot with silver, leather "
            "vestments embroidered with sun motifs, holding a small lit lantern, "
            "soft golden light, painted in the style of a tavern hearth painting, "
            "warm, hopeful, oil paint texture, 3:4 portrait."
        ),
        "sheet": {
            "name": _wrap("Aerith Lightbringer"),
            "race": _wrap("Hill Dwarf"),
            "char_class": _wrap("Cleric"),
            "background": _wrap("Acolyte"),
            "alignment": _wrap("Neutral Good"),
            "level": _wrap(4),
            "stats": _wrap({"str": 12, "dex": 10, "con": 16, "int": 11, "wis": 18, "cha": 13}),
            "proficiencies": _wrap(["Insight", "Religion", "Medicine"], locked=False),
            "spells": _wrap(
                ["Sacred Flame", "Guidance", "Light", "Bless", "Cure Wounds", "Sanctuary", "Spiritual Weapon"],
                locked=False,
            ),
            "equipment": _wrap(
                ["Mace", "Chain Shirt", "Holy Symbol of the Dawn", "Healer's Kit", "Lantern of the Harbor"],
                locked=False,
            ),
            "personality": _wrap(
                "Steady, quietly stubborn, prone to long silences before kindness. "
                "Keeps a tally of every soul she's failed to save and a list of every one she still might.",
                locked=False,
            ),
            "backstory": _wrap(
                "Born in a hill cleft above the Burned Harbor, Aerith took vows the night the wharves "
                "went up. She has tended the last surviving harbor lamp for eleven winters; sailors who "
                "spot it from open water still call her 'Lightbringer' though she insists the title is the lamp's.",
                locked=False,
            ),
        },
    },
    {
        "name": "Thorin Bloodthorn",
        "summary": "A Half-Orc Barbarian wandering between feuds with a debt he won't name.",
        "portrait_prompt": None,
        "sheet": {
            "name": _wrap("Thorin Bloodthorn"),
            "race": _wrap("Half-Orc"),
            "char_class": _wrap("Barbarian"),
            "background": _wrap("Outlander"),
            "alignment": _wrap("Chaotic Neutral"),
            "level": _wrap(3),
            "stats": _wrap({"str": 17, "dex": 14, "con": 16, "int": 10, "wis": 12, "cha": 8}),
            "proficiencies": _wrap(["Athletics", "Survival", "Intimidation"], locked=False),
            "spells": _wrap([], locked=False),
            "equipment": _wrap(["Greataxe", "Two Handaxes", "Explorer's Pack", "Bear Tooth Necklace"], locked=False),
            "personality": _wrap(
                "Speaks in compact sentences. Sleeps with one eye on the door. "
                "Laughs only at jokes about himself.",
                locked=False,
            ),
            "backstory": _wrap(
                "Walked away from the Ash Hollow clan-feud the morning his sister fell. He follows "
                "rumours of mercenary work westward and pays for ale by splitting cordwood — the "
                "tavern keeper hasn't asked him his real name and he hasn't offered it.",
                locked=False,
            ),
        },
    },
    {
        "name": "Soren Nightfall",
        "summary": "A Tiefling Warlock who bargained for sight and never told anyone what she saw.",
        "portrait_prompt": None,
        "sheet": {
            "name": _wrap("Soren Nightfall"),
            "race": _wrap("Tiefling"),
            "char_class": _wrap("Warlock"),
            "background": _wrap("Charlatan"),
            "alignment": _wrap("Chaotic Good"),
            "level": _wrap(5),
            "stats": _wrap({"str": 8, "dex": 14, "con": 14, "int": 12, "wis": 13, "cha": 17}),
            "proficiencies": _wrap(["Deception", "Sleight of Hand", "Arcana"], locked=False),
            "spells": _wrap(
                ["Eldritch Blast", "Mage Hand", "Hex", "Misty Step", "Counterspell", "Hold Monster"],
                locked=False,
            ),
            "equipment": _wrap(
                ["Quarterstaff (pact focus)", "Leather Armour", "Component Pouch", "Carved Bone Mask"],
                locked=False,
            ),
            "personality": _wrap(
                "Charming when it suits her, blunt when it doesn't. Refuses to drink anything she "
                "didn't pour herself.",
                locked=False,
            ),
            "backstory": _wrap(
                "She traded a memory she still can't recall for sight beyond sight. The voice that "
                "answered her speaks in second-person and sometimes signs notes with her own initials.",
                locked=False,
            ),
        },
    },
    {
        "name": "Mira Quickfoot",
        "summary": "A Lightfoot Halfling Rogue who's never picked a pocket she didn't put back.",
        "portrait_prompt": None,
        "sheet": {
            "name": _wrap("Mira Quickfoot"),
            "race": _wrap("Lightfoot Halfling"),
            "char_class": _wrap("Rogue"),
            "background": _wrap("Criminal"),
            "alignment": _wrap("Chaotic Good"),
            "level": _wrap(4),
            "stats": _wrap({"str": 9, "dex": 18, "con": 14, "int": 13, "wis": 12, "cha": 14}),
            "proficiencies": _wrap(["Deception", "Stealth", "Acrobatics", "Sleight of Hand"], locked=False),
            "spells": _wrap([], locked=False),
            "equipment": _wrap(
                ["Shortsword", "Shortbow", "Burglar's Pack", "Lockpicks", "Lucky Copper"],
                locked=False,
            ),
            "personality": _wrap(
                "Cheerful, ferociously punctual, unable to lie to anyone she's broken bread with.",
                locked=False,
            ),
            "backstory": _wrap(
                "Grew up under a dock that no longer exists. The Burned Harbor scattered her crew and "
                "she's spent four years looking for them by quiet means.",
                locked=False,
            ),
        },
    },
    {
        "name": "Caelinn Moonwhisper",
        "summary": "A High Elf Wizard with a library on her back and patience to burn.",
        "portrait_prompt": None,
        "sheet": {
            "name": _wrap("Caelinn Moonwhisper"),
            "race": _wrap("High Elf"),
            "char_class": _wrap("Wizard"),
            "background": _wrap("Sage"),
            "alignment": _wrap("Lawful Neutral"),
            "level": _wrap(6),
            "stats": _wrap({"str": 8, "dex": 14, "con": 14, "int": 18, "wis": 13, "cha": 11}),
            "proficiencies": _wrap(["Arcana", "History", "Investigation"], locked=False),
            "spells": _wrap(
                [
                    "Fire Bolt",
                    "Mage Hand",
                    "Prestidigitation",
                    "Mage Armor",
                    "Magic Missile",
                    "Shield",
                    "Misty Step",
                    "Counterspell",
                    "Fireball",
                ],
                locked=False,
            ),
            "equipment": _wrap(
                ["Quarterstaff", "Component Pouch", "Spellbook (silver clasps)", "Inkstone & quills"],
                locked=False,
            ),
            "personality": _wrap(
                "Deliberate. Listens twice before she answers. Will quote her sources unprompted.",
                locked=False,
            ),
            "backstory": _wrap(
                "She left an archive in the Mulan capital when its patron began burning what couldn't "
                "be copied. The Burned Harbor's wharves are the first time she's stayed put longer than a season.",
                locked=False,
            ),
        },
    },
]


LORE_ENTRIES: list[dict[str, str]] = [
    {
        "title": "The Burned Harbor",
        "body": (
            "Twelve winters past, the harbor of Tellem's Reach went up in a single night. "
            "Every ship at dock burned to the waterline, and the wharves themselves blackened "
            "to coal. No survivor agrees on how the fire began — some name a careless lantern, "
            "some name a debt, some name a god that should have been left in the deep.\n\n"
            "What everyone agrees on: the harbor never quite stopped smelling of smoke. Sailors "
            "who put in for the night swear the gulls overhead are quieter, and the lamp above "
            "the headland — Aerith's lamp — has never once gone out."
        ),
    },
    {
        "title": "The Pact of Embers",
        "body": (
            "Two clans, the Bloodthorns of the high country and the Ironpeaks of the river bend, "
            "ended their century-long feud on the morning the harbor burned. They did not embrace. "
            "They stood across the smoking pier and made an oath that has been called the Pact of "
            "Embers ever since: that neither clan would shed the other's blood until the harbor was "
            "rebuilt and the ships sailed again.\n\n"
            "The harbor remains rubble. The oath, by every account, remains kept."
        ),
    },
]


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def ensure_user(sb, email: str, password: str) -> str:
    """Create the demo user if it doesn't exist; return its uuid either way."""
    # supabase-py's admin API: create_user; falls through to list_users if it already exists.
    try:
        res = sb.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
            }
        )
        return res.user.id
    except Exception as exc:  # already-exists / network / quota — handle uniformly
        # Find the user by email instead.
        return find_user_by_email(sb, email) or _raise(
            f"Couldn't create or find user {email!r}: {exc}", exc
        )


def find_user_by_email(sb, email: str) -> str | None:
    target = email.lower()
    page = 1
    while True:
        res = sb.auth.admin.list_users(page=page, per_page=200)
        users = getattr(res, "users", None) or res
        if not users:
            return None
        for u in users:
            if (getattr(u, "email", "") or "").lower() == target:
                return u.id
        page += 1
        if page > 20:
            return None


def _raise(msg: str, cause: Exception) -> Any:
    raise RuntimeError(msg) from cause


def clean_prior_seed(sb, user_ids: list[str]) -> None:
    """Wipe rows the previous run created so this one is a clean rebuild."""
    if not user_ids:
        return
    # Order matters: party_members → parties; friendships; portraits; songs; lore; characters.
    sb.table("party_members").delete().in_("user_id", user_ids).execute()
    sb.table("parties").delete().in_("owner_id", user_ids).execute()
    sb.table("friendships").delete().in_("requester_id", user_ids).execute()
    sb.table("friendships").delete().in_("addressee_id", user_ids).execute()
    sb.table("portraits").delete().in_("user_id", user_ids).execute()
    sb.table("bard_songs").delete().in_("user_id", user_ids).execute()
    sb.table("world_lore").delete().in_("user_id", user_ids).execute()
    sb.table("characters").delete().in_("user_id", user_ids).execute()


def seed_characters(sb, user_id: str) -> list[dict]:
    """Insert every CHARACTERS row under ``user_id``. Returns the inserted rows
    (with the generated uuids) in the same order."""
    inserted: list[dict] = []
    for c in CHARACTERS:
        row = (
            sb.table("characters")
            .insert({"user_id": user_id, "name": c["name"], "sheet": c["sheet"]})
            .execute()
        )
        if not row.data:
            raise RuntimeError(f"Insert failed for {c['name']!r}")
        inserted.append(row.data[0])
    return inserted


def seed_lore(sb, user_id: str) -> list[dict]:
    rows = sb.table("world_lore").insert(
        [{"user_id": user_id, "title": l["title"], "body": l["body"]} for l in LORE_ENTRIES]
    ).execute()
    return rows.data or []


def seed_social(
    sb,
    owner_id: str,
    companions: list[tuple[str, str]],
) -> dict[str, Any]:
    """Build a lively Notice Board for ``owner_id``.

    Seeds, in order:
      * one accepted friendship (companion 0 ↔ owner — the established raven)
      * one incoming pending request  (companion 1 → owner)  ← needs response
      * one outgoing pending request (owner → companion 2)  ← awaiting
      * one party owned by ``owner_id`` with the raven seated
      * one party owned by the raven with ``owner_id`` seated (so the
        roster shows the user belongs to more than one)

    Companions is a list of ``(user_id, label)``. Indexed 0..3.
    """
    (raven_id, raven_label) = companions[0]
    (incoming_id, incoming_label) = companions[1]
    (outgoing_id, outgoing_label) = companions[2]

    # Friendships ------------------------------------------------------
    sb.table("friendships").insert(
        [
            {"requester_id": raven_id, "addressee_id": owner_id, "status": "accepted"},
            {"requester_id": incoming_id, "addressee_id": owner_id, "status": "pending"},
            {"requester_id": owner_id, "addressee_id": outgoing_id, "status": "pending"},
        ]
    ).execute()

    return {
        "raven_id": raven_id,
        "raven_label": raven_label,
        "incoming_pending_from": incoming_label,
        "outgoing_pending_to": outgoing_label,
    }


def seed_parties(
    sb,
    owner_id: str,
    raven_id: str,
    owner_char_ids: list[str],
) -> list[str]:
    """One party owned by the user, one party they're invited to."""
    parties_data = [
        {"owner_id": owner_id, "name": "The Burned Harbor Quartet"},
        {"owner_id": raven_id, "name": "Raven's Reach"},
    ]
    res = sb.table("parties").insert(parties_data).execute()
    party_ids = [row["id"] for row in res.data]
    sb.table("party_members").insert(
        [
            # Owner's party — user is leader, raven is a scribe
            {
                "party_id": party_ids[0],
                "user_id": owner_id,
                "character_id": owner_char_ids[0],
                "role": "leader",
            },
            {
                "party_id": party_ids[0],
                "user_id": raven_id,
                "character_id": None,
                "role": "scribe",
            },
            # Raven's party — user is a member, raven leads
            {
                "party_id": party_ids[1],
                "user_id": raven_id,
                "character_id": None,
                "role": "leader",
            },
            {
                "party_id": party_ids[1],
                "user_id": owner_id,
                "character_id": owner_char_ids[2] if len(owner_char_ids) > 2 else owner_char_ids[0],
                "role": "vanguard",
            },
        ]
    ).execute()
    return party_ids


async def seed_portrait_for_aerith(sb, user_id: str, character_id: str) -> str | None:
    """Generate one real portrait via fal.ai for the Cleric and persist it.
    Skips cleanly (returns ``None``) if ``FAL_KEY`` isn't set."""
    if not os.environ.get("FAL_KEY"):
        return None
    from app.providers import fal as fal_provider  # noqa: WPS433 — script-level import is fine
    from app.providers import storage

    prompt = next(c for c in CHARACTERS if c["name"] == "Aerith Lightbringer")["portrait_prompt"]
    result = await fal_provider.generate_portrait(prompt=prompt, aspect_ratio="3:4")
    image_url = await storage.persist_image(
        user_id=user_id,
        source_url=result.image_url,
        suggested_name=f"portrait-{uuid.uuid4()}.jpg",
    )
    sb.table("portraits").insert(
        {
            "user_id": user_id,
            "character_id": character_id,
            "prompt": prompt,
            "model": "fal-ai/flux-pro/v1.1-ultra",
            "status": "ready",
            "stage": "ready",
            "image_url": image_url,
            "is_current": True,
            "cost_usd": result.cost_usd or 0.06,
        }
    ).execute()
    return image_url


def seed_songs(
    sb,
    user_id: str,
    feat_character_id: str,
    party_id: str | None,
    lore_id: str | None,
) -> None:
    """Insert pre-composed song rows. ``audio_url`` stays null because we
    don't have a Suno reseller key wired up yet; the BardStage library
    still renders the rows with the 'still singing…' / 'ready' chip + the
    lyrics body, so the UX is demonstrable end-to-end.

    Covers every scope:
      * feat — Aerith's lamp (ready, full lyrics)
      * party — The Burned Harbor Quartet (still singing — pending row)
      * lore — The Pact of Embers (ready, full lyrics)
    """
    rows: list[dict[str, Any]] = [
        {
            "user_id": user_id,
            "scope": "feat",
            "source_id": feat_character_id,
            "prompt": "A quiet hymn for Aerith's lamp, sung at the harbor's edge.",
            "lyrics": (
                "Steady the hand that lit the lamp,\n"
                "Steady the wick, the oil, the flame —\n"
                "Twelve long winters of salt and damp,\n"
                "Twelve long names she'd not name in vain.\n\n"
                "Sailors home through the dark below,\n"
                "Steer to her light, steer to her light,\n"
                "Steady the hand and the lamp's soft glow,\n"
                "Steady the harbor that holds the night."
            ),
            "model": "claude-sonnet-4-6",
            "status": "ready",
            "duration_s": 90,
            "cost_usd": 0.0,
        },
    ]
    if party_id:
        rows.append(
            {
                "user_id": user_id,
                "scope": "party",
                "source_id": party_id,
                "prompt": "A bawdy march about the Quartet's tally of pints and oaths.",
                "lyrics": None,  # still being composed
                "model": "claude-sonnet-4-6",
                "status": "pending",  # shows the "still singing…" chip
                "duration_s": None,
                "cost_usd": 0.0,
            }
        )
    if lore_id:
        rows.append(
            {
                "user_id": user_id,
                "scope": "lore",
                "source_id": lore_id,
                "prompt": "A drinking song about the Pact of Embers and the night the wharves burned.",
                "lyrics": (
                    "Two clans stood by the smoking quay,\n"
                    "Bloodthorn red and Ironpeak grey,\n"
                    "Neither weeping, neither praying,\n"
                    "Only watching the timbers fraying.\n\n"
                    "Pour the ash and pour the ember,\n"
                    "Pour again for what we remember,\n"
                    "Pour the pact our fathers swore —\n"
                    "Hold it 'til the ships come home once more."
                ),
                "model": "claude-sonnet-4-6",
                "status": "ready",
                "duration_s": 110,
                "cost_usd": 0.0,
            }
        )
    sb.table("bard_songs").insert(rows).execute()


# ----------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-portrait",
        action="store_true",
        help="Skip the fal.ai call even if FAL_KEY is set (saves ~$0.06).",
    )
    parser.add_argument(
        "--owner-id",
        help=(
            "Existing auth.users uuid to seed under, instead of creating "
            "the default demo@tomois.tavern user. Use this to attach the "
            "demo state to a real account."
        ),
    )
    parser.add_argument(
        "--owner-email",
        help=(
            "Like --owner-id but looks up the uuid by email. Errors out if "
            "the user doesn't exist; this script never modifies a real "
            "person's auth row."
        ),
    )
    args = parser.parse_args()

    sb = create_client(SB_URL, SB_SERVICE_KEY)
    print(f"  → connected to {SB_URL}")

    # Resolve owner. Three modes: --owner-id, --owner-email, or the
    # default demo@tomois.tavern (created/ensured).
    if args.owner_id:
        owner_id = args.owner_id
        owner_label = f"user {owner_id}"
        owner_signin = "(use your existing credentials)"
    elif args.owner_email:
        looked = find_user_by_email(sb, args.owner_email)
        if not looked:
            print(f"ERROR: no user with email {args.owner_email!r}.", file=sys.stderr)
            return 1
        owner_id = looked
        owner_label = f"{args.owner_email} ({owner_id})"
        owner_signin = "(use your existing credentials)"
    else:
        owner_id = ensure_user(sb, DEMO_EMAIL, DEMO_PASSWORD)
        owner_label = f"{DEMO_EMAIL} ({owner_id})"
        owner_signin = f"{DEMO_EMAIL}  /  {DEMO_PASSWORD}"

    print(f"  → owner: {owner_label}")

    print("  → ensuring companion users…")
    companions: list[tuple[str, str]] = []  # (user_id, label)
    for email, password, label in COMPANION_USERS:
        cid = ensure_user(sb, email, password)
        companions.append((cid, label))
        print(f"    {label} {cid}")

    # Scrub prior seed data across all touched users so re-runs are clean.
    print("  → scrubbing prior seed data…")
    all_ids = [owner_id] + [c[0] for c in companions]
    clean_prior_seed(sb, all_ids)

    print("  → seeding characters under the owner…")
    chars = seed_characters(sb, owner_id)
    aerith = chars[0]
    print(f"    {len(chars)} characters seated at the Round Table")

    print("  → seeding world lore…")
    lore_rows = seed_lore(sb, owner_id)
    print(f"    {len(lore_rows)} pages inked into the book")

    print("  → seeding friendships + parties…")
    social = seed_social(sb, owner_id, companions)
    party_ids = seed_parties(sb, owner_id, social["raven_id"], [c["id"] for c in chars])
    print(f"    1 accepted friendship + 1 incoming + 1 outgoing pending")
    print(f"    2 parties (1 owned + 1 invited): {', '.join(party_ids)}")

    if args.skip_portrait:
        print("  → skipping portrait (--skip-portrait)")
        portrait_url = None
    else:
        print("  → painting Aerith at the mirror (fal.ai)…")
        portrait_url = asyncio.run(seed_portrait_for_aerith(sb, owner_id, aerith["id"]))
        if portrait_url:
            print(f"    portrait persisted at {portrait_url}")
        else:
            print("    skipped (FAL_KEY not set)")

    print("  → seeding bard songs (lyrics-only; no Suno key on file)…")
    first_lore_id = lore_rows[0]["id"] if lore_rows else None
    seed_songs(sb, owner_id, aerith["id"], party_ids[0], first_lore_id)
    print("    3 songs (feat ready, party pending, lore ready) hung above the bar")

    print()
    print("Demo ready. Sign in to the web app:")
    print(f"  • {owner_signin}")
    print()
    print("Notice Board should show: 1 friend, 1 incoming invite, 1 outgoing")
    print("request, 2 active parties. Bard library shows 3 songs across all")
    print("three scopes. Round Table shows 5 heroes; Mirror has Aerith painted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
