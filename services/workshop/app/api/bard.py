"""Tavern Bard — POST /songs to generate a song about a feat, party, or lore entry.

Pipeline:
  1. Claude generates lyrics from the scope + context (character feat, party deeds, lore).
  2. Suno (via reseller) generates an audio track conditioned on those lyrics + genre.
  3. The resulting audio is mirrored into Supabase Storage and a bard_songs row is written.
"""
from typing import Optional, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..db import user_client
from ..providers import lyrics as lyrics_provider
from ..providers import music as music_provider
from ..providers import storage
from ..rate_limit import limiter, song_limit

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
@limiter.limit(song_limit)
async def create_song(
    request: Request,
    body: SongRequest,
    user: CurrentUser = Depends(get_current_user),
):
    # ``scope="lore"`` now reads from the world_lore table (see
    # ``app.api.lore`` for the CRUD). source_id is required for lore so
    # the lyrics generator has actual context to ground against —
    # without it the song would just be the user_prompt rewritten.
    if body.scope == "lore" and not body.source_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Point the bard at a lore entry first.",
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
        # 2. Audio from the music provider — Replicate MiniMax Music by
        # default, Suno reseller as a legacy fallback.
        audio_result = await music_provider.generate_song(
            lyrics=lyrics_text,
            genre=body.genre,
            title=f"Bard's song — {body.scope}",
        )
    except Exception as exc:
        db.table("bard_songs").update({"status": "failed"}).eq("id", song_id).execute()
        # Tavern-flavoured 502 for the common provider failures so the
        # frontend's toast reads in voice.
        detail = "The bard's lute is unstrung."
        msg = str(exc)
        if "REPLICATE_API_TOKEN" in msg or "SUNO_API_KEY" in msg or "No music provider" in msg:
            detail = "The bard's lute is unstrung — no music provider is configured."
        elif "timed out" in msg.lower():
            detail = "The bard tires before the last verse — try again."
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
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
