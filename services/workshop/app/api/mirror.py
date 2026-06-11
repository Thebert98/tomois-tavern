"""Magic Mirror — async portrait generation.

POST /portraits returns immediately with a queued row; the actual Flux call
runs in a FastAPI BackgroundTask that updates the row when it finishes. The
frontend subscribes via Supabase Realtime and shows a progress bar.

Sprite/animation pipeline is archived on the `archive/sprites-pipeline`
branch; restore it from there if needed.
"""
import datetime as dt
import logging
import traceback
from typing import Any, Optional
from urllib.parse import urlparse

from pydantic import Field

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..db import service_client, user_client
from ..providers import fal as fal_provider
from ..providers import storage
from ..rate_limit import limiter, portrait_limit

router = APIRouter(prefix="/portraits", tags=["mirror"])
log = logging.getLogger("workshop.mirror")


class PortraitRequest(BaseModel):
    character_id: str
    # 2000 chars is comfortably above the longest distilled prompt
    # we ever emit (portraitPrompt.ts caps backstory at 260 chars and
    # personality at 140, plus ~600 chars of equipment/iconography).
    # Anything larger is almost certainly client error or abuse.
    prompt: str = Field(min_length=1, max_length=2000)
    aspect_ratio: str = "3:4"


class PortraitResponse(BaseModel):
    id: str
    character_id: str
    image_url: Optional[str]
    is_current: bool
    status: str
    stage: Optional[str]
    prompt: str
    model: str
    cost_usd: Optional[float]


async def _run_pipeline(
    portrait_id: str,
    user_id: str,
    character_id: str,
    prompt: str,
    aspect_ratio: str,
) -> None:
    db = service_client()

    def _patch(**fields: Any) -> None:
        db.table("portraits").update(fields).eq("id", portrait_id).execute()

    try:
        _patch(stage="painting")
        portrait_result = await fal_provider.generate_portrait(
            prompt=prompt, aspect_ratio=aspect_ratio
        )
        image_url = await storage.persist_image(
            user_id=user_id,
            source_url=portrait_result.image_url,
            suggested_name=f"portrait-{portrait_id}.jpg",
        )
        _patch(
            image_url=image_url,
            status="ready",
            stage="ready",
            cost_usd=portrait_result.cost_usd or 0,
        )
        # Auto-mark current if this character has no active portrait yet.
        # Saves the player a separate "set active" click in the common
        # case of one portrait per hero.
        _auto_set_current_if_only(db, character_id, portrait_id)
    except Exception:
        log.error("Portrait painting failed:\n%s", traceback.format_exc())
        _patch(status="failed", stage="failed")


def _auto_set_current_if_only(db, character_id: str, portrait_id: str) -> None:
    """If ``character_id`` has no active portrait, mark ``portrait_id``
    as current. Safe to call after every successful generation.
    """
    if not character_id:
        return
    existing = (
        db.table("portraits")
        .select("id")
        .eq("character_id", character_id)
        .eq("is_current", True)
        .execute()
        .data
        or []
    )
    if existing:
        return
    db.table("portraits").update({"is_current": True}).eq("id", portrait_id).execute()


@router.post("", response_model=PortraitResponse)
@limiter.limit(portrait_limit)
def create_portrait(
    request: Request,  # slowapi requires Request to extract the key
    body: PortraitRequest,
    background: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    pending = (
        db.table("portraits")
        .insert(
            {
                "user_id": user.id,
                "character_id": body.character_id,
                "prompt": body.prompt,
                "model": "fal-ai/flux-pro/v1.1-ultra",
                "status": "pending",
                "stage": "queued",
            }
        )
        .execute()
    )
    if not pending.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue portrait",
        )
    portrait_id = pending.data[0]["id"]

    background.add_task(
        _run_pipeline,
        portrait_id,
        user.id,
        body.character_id,
        body.prompt,
        body.aspect_ratio,
    )

    return PortraitResponse(
        id=portrait_id,
        character_id=body.character_id,
        image_url=None,
        is_current=False,
        status="pending",
        stage="queued",
        prompt=body.prompt,
        model="fal-ai/flux-pro/v1.1-ultra",
        cost_usd=None,
    )


_STALE_PENDING_MINUTES = 10


def _reap_stale_pending(db, user_id: str) -> None:
    """Mark any of the caller's pending portraits older than 10 minutes
    as ``failed``. This is the safety net for the rare case where the
    BackgroundTask never started (server crash, scheduler starvation):
    without it, the row sits at ``stage=queued`` forever and the UI
    shows "stirring…" indefinitely. The reap runs at list time so the
    UI's view of the world is always self-healing.
    """
    cutoff = dt.datetime.now(dt.UTC) - dt.timedelta(minutes=_STALE_PENDING_MINUTES)
    db.table("portraits").update(
        {"status": "failed", "stage": "failed"}
    ).eq("user_id", user_id).eq("status", "pending").lt(
        "created_at", cutoff.isoformat()
    ).execute()


@router.get("", response_model=list[dict[str, Any]])
def list_portraits(
    user: CurrentUser = Depends(get_current_user),
    character_id: Optional[str] = None,
):
    db = user_client(user.token)
    _reap_stale_pending(db, user.id)
    q = db.table("portraits").select("*").order("created_at", desc=True)
    if character_id:
        q = q.eq("character_id", character_id)
    return q.limit(100).execute().data


@router.patch("/{portrait_id}/current", response_model=dict[str, Any])
def set_current_portrait(
    portrait_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Mark this portrait as the character's active one.

    Originally relied on the ``set_current_portrait`` RPC (migration
    ``0007``) so the swap was a single atomic UPDATE — important
    because of the partial unique index
    ``portraits_one_current_per_character``. But this project's
    PostgREST schema cache won't load custom functions, so the RPC
    permanently 500s with PGRST202.

    Fallback that works: do it through service_client as two writes —
    clear the existing current portrait for this character first, THEN
    set the new one. The partial unique index is briefly satisfied by
    the empty state in between, so no constraint violation. Race window
    only matters for two simultaneous set-current calls on the same
    character, which doesn't realistically happen in this app.
    """
    sb = service_client()
    res = (
        sb.table("portraits")
        .select("user_id,character_id")
        .eq("id", portrait_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    row = res.data[0]
    if row["user_id"] != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your portrait")
    character_id = row["character_id"]
    if not character_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Portrait is not linked to a character.",
        )

    # 1. Clear whichever portrait was active.
    sb.table("portraits").update({"is_current": False}).eq(
        "character_id", character_id
    ).eq("is_current", True).execute()
    # 2. Set this one as the new current.
    updated = (
        sb.table("portraits")
        .update({"is_current": True})
        .eq("id", portrait_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    return updated.data[0]


@router.delete("/{portrait_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portrait(
    portrait_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a portrait + its storage objects. RLS scopes the row delete
    to the owner; storage cleanup uses the service-role client because the
    `portraits` storage bucket policy keys on `(storage.foldername(name))[1]
    = auth.uid()::text` which matches user_client too — but the service
    client is simpler and safer (already used by the upload pipeline)."""
    db = user_client(user.token)

    # Verify ownership (RLS will also block, but a clean 404 is friendlier).
    row = (
        db.table("portraits")
        .select("user_id,image_url,sprite_url,sprite_frames")
        .eq("id", portrait_id)
        .execute()
    )
    if not row.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    record = row.data[0]
    if record["user_id"] != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your portrait")

    # Best-effort storage cleanup; failures here don't block the row delete.
    sb = service_client()
    paths: list[str] = []
    for url_key in ("image_url", "sprite_url"):
        url = record.get(url_key) or ""
        path = _storage_path_from_url(url, bucket="portraits")
        if path:
            paths.append(path)
    for frame_url in record.get("sprite_frames") or []:
        path = _storage_path_from_url(frame_url, bucket="portraits")
        if path:
            paths.append(path)
    if paths:
        try:
            sb.storage.from_("portraits").remove(paths)
        except Exception as exc:
            log.warning("Storage cleanup failed for portrait %s: %s", portrait_id, exc)

    delete = db.table("portraits").delete().eq("id", portrait_id).execute()
    if not delete.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    return None


def _storage_path_from_url(url: str, *, bucket: str) -> Optional[str]:
    """Extract the object key inside ``bucket`` from a Supabase public URL.

    e.g. ``https://.../storage/v1/object/public/portraits/{user}/{file}``
    → ``{user}/{file}``. Returns ``None`` if the URL doesn't match the
    expected shape — and logs a warning so orphaned storage objects don't
    fail silently (the old version's silent skip was the root cause of
    audit finding W3).
    """
    if not url:
        return None
    try:
        parsed = urlparse(url)
    except ValueError:
        log.warning("Could not parse storage URL: %r", url)
        return None
    marker = f"/storage/v1/object/public/{bucket}/"
    if marker not in parsed.path:
        log.warning(
            "URL doesn't match expected Supabase storage shape "
            "(bucket=%r): %r",
            bucket,
            url,
        )
        return None
    return parsed.path.split(marker, 1)[1]
