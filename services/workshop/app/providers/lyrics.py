"""Claude Sonnet — generate tavern-style D&D song lyrics from a feat / party / lore.

Pulls context out of the right table (with the user's RLS-scoped client) so
lyrics are grounded in the player's actual story, not hallucinated.
"""
from typing import Optional, Literal

import anthropic

from ..config import settings

_client: Optional[anthropic.AsyncAnthropic] = None


def _anthropic() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _context_for(db, scope: str, source_id: Optional[str]) -> str:
    """Pull a compact context string from the right table for the given scope."""
    if not source_id:
        return ""
    if scope == "feat":
        res = db.table("characters").select("name,sheet").eq("id", source_id).execute()
        if not res.data:
            return ""
        c = res.data[0]
        return f"Character: {c['name']}\nSheet: {c['sheet']}"
    if scope == "party":
        res = db.table("parties").select("name").eq("id", source_id).execute()
        if not res.data:
            return ""
        members = (
            db.table("party_members")
            .select("character_id,role,characters(name,sheet)")
            .eq("party_id", source_id)
            .execute()
        )
        return f"Party: {res.data[0]['name']}\nMembers: {members.data}"
    if scope == "lore":
        res = db.table("world_lore").select("title,body").eq("id", source_id).execute()
        if not res.data:
            return ""
        l = res.data[0]
        return f"Lore — {l['title']}:\n{l['body']}"
    return ""


SYSTEM = (
    "You are a tavern bard composing short songs in the voice of medieval folk "
    "ballads. Write 12-20 lines of singable lyrics with a clear verse / chorus "
    "structure. Stay grounded in the provided context — invent details only when "
    "they're consistent with what's given. No modern slang. Output ONLY the lyrics, "
    "no titles or commentary."
)


async def generate_lyrics(
    db,
    scope: Literal["feat", "party", "lore"],
    source_id: Optional[str],
    user_prompt: str,
) -> str:
    context = _context_for(db, scope, source_id)
    user_msg = (
        f"Scope: {scope}\n"
        f"Bard's nudge from the user: {user_prompt}\n\n"
        f"Context to ground the song in:\n{context or '(none — improvise tastefully)'}"
    )
    resp = await _anthropic().messages.create(
        model=settings.anthropic_model,
        max_tokens=800,
        system=SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )
    return resp.content[0].text.strip()
