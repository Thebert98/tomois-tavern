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

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..db import service_client, user_client
from ..providers import fal as fal_provider
from ..providers import storage

router = APIRouter(prefix="/portraits", tags=["mirror"])
log = logging.getLogger("workshop.mirror")


class PortraitRequest(BaseModel):
    character_id: str
    prompt: str
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
    except Exception:
        log.error("Portrait painting failed:\n%s", traceback.format_exc())
        _patch(status="failed", stage="failed")


@router.post("", response_model=PortraitResponse)
def create_portrait(
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
        _run_pipeline, portrait_id, user.id, body.prompt, body.aspect_ratio
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

    Two UPDATEs (clear-all-then-set) was racy: a concurrent call between
    the two statements would violate the partial unique index
    ``portraits_one_current_per_character`` and 500. We now go through
    the ``set_current_portrait`` RPC (migration ``0007``) which does it
    in a single atomic UPDATE so the in-flight state is never visible.
    """
    db = user_client(user.token)
    res = (
        db.table("portraits")
        .select("character_id")
        .eq("id", portrait_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    if not res.data[0]["character_id"]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Portrait is not linked to a character.",
        )
    rpc = db.rpc("set_current_portrait", {"p_portrait_id": portrait_id}).execute()
    if not rpc.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    return rpc.data


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
    """Extract the object key inside `bucket` from a Supabase public URL.
    e.g. ``https://.../storage/v1/object/public/portraits/{user}/{file}``
    → ``{user}/{file}``. Returns None if the URL doesn't match."""
    if not url:
        return None
    marker = f"/storage/v1/object/public/{bucket}/"
    idx = url.find(marker)
    if idx == -1:
        return None
    return url[idx + len(marker) :]
