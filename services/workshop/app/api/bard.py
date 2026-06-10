"""Tavern Bard — POST /songs to generate a song about a feat, party, or lore entry.

Pipeline:
  1. Claude generates lyrics from the scope + context (character feat, party deeds, lore).
  2. Suno (via reseller) generates an audio track conditioned on those lyrics + genre.
  3. The resulting audio is mirrored into Supabase Storage and a bard_songs row is written.
"""
from typing import Optional, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..db import user_client
from ..providers import lyrics as lyrics_provider
from ..providers import suno as suno_provider
from ..providers import storage

router = APIRouter(prefix="/songs", tags=["bard"])


class SongRequest(BaseModel):
    scope: Literal["feat", "party", "lore"]
    source_id: Optional[str] = None  # character_id / party_id / world_lore.id
    prompt: str  # user's nudge ("a triumphant ballad about defeating the lich")
    genre: str = "medieval tavern folk"


class SongResponse(BaseModel):
    id: str
    audio_url: Optional[str]
    lyrics: Optional[str]
    status: str
    duration_s: Optional[int]
    cost_usd: Optional[float]


@router.post("", response_model=SongResponse)
async def create_song(
    body: SongRequest,
    user: CurrentUser = Depends(get_current_user),
):
    # PLAN.md notes lore CRUD is intentionally deferred — the UI hides the
    # scope but a direct POST would route into the lyrics generator and
    # try to read from an empty world_lore table. Fail loudly with a
    # tavern-flavoured message until those endpoints land.
    if body.scope == "lore":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Songs of the land aren't woven yet.",
        )
    db = user_client(user.token)

    pending = (
        db.table("bard_songs")
        .insert(
            {
                "user_id": user.id,
                "scope": body.scope,
                "source_id": body.source_id,
                "prompt": body.prompt,
                "model": "suno-v4",
                "status": "pending",
            }
        )
        .execute()
    )
    song_id = pending.data[0]["id"]

    try:
        # 1. Lyrics from Claude — pulls context from the right source table.
        lyrics_text = await lyrics_provider.generate_lyrics(
            db=db,
            scope=body.scope,
            source_id=body.source_id,
            user_prompt=body.prompt,
        )
        # 2. Audio from Suno (reseller).
        audio_result = await suno_provider.generate_song(
            lyrics=lyrics_text,
            genre=body.genre,
            title=f"Bard's song — {body.scope}",
        )
    except Exception as exc:
        db.table("bard_songs").update({"status": "failed"}).eq("id", song_id).execute()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Song generation failed: {exc}",
        ) from exc

    public_url = await storage.persist_audio(
        user_id=user.id,
        source_url=audio_result.audio_url,
        suggested_name=f"song-{song_id}.mp3",
    )

    db.table("bard_songs").update(
        {
            "lyrics": lyrics_text,
            "audio_url": public_url,
            "status": "ready",
            "duration_s": audio_result.duration_s,
            "cost_usd": audio_result.cost_usd,
        }
    ).eq("id", song_id).execute()

    return SongResponse(
        id=song_id,
        audio_url=public_url,
        lyrics=lyrics_text,
        status="ready",
        duration_s=audio_result.duration_s,
        cost_usd=audio_result.cost_usd,
    )


@router.get("", response_model=list[dict[str, Any]])
def list_songs(user: CurrentUser = Depends(get_current_user)):
    db = user_client(user.token)
    res = (
        db.table("bard_songs")
        .select("*")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data
