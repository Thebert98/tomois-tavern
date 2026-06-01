"""Magic Mirror — async portrait + sprite + idle-animation pipeline.

POST /portraits returns immediately with a portrait_id; the heavy work runs in
a background task that updates the row stage-by-stage. The frontend subscribes
to the row over Supabase Realtime and shows a progress bar.

Stages (in order):
  queued      — row just inserted
  painting    — calling Flux 1.1 Pro
  sculpting   — converting portrait → pixel art via PixelLab image-to-pixelart
  animating   — generating idle frames via PixelLab animate-with-text-v3
  ready       — done; image/sprite/frames all persisted
  failed      — unrecoverable error (sprite/animation failures don't reach
                here — they degrade gracefully)
"""
import base64
import logging
import traceback
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..db import service_client, user_client
from ..providers import fal as fal_provider
from ..providers import pixellab as pixellab_provider
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
    sprite_url: Optional[str]
    sprite_frames: Optional[list[str]] = None
    is_current: bool
    status: str
    stage: Optional[str]
    prompt: str
    model: str
    cost_usd: Optional[float]


# ---------------------------------------------------------------------------
# Background pipeline
# ---------------------------------------------------------------------------
async def _run_pipeline(
    portrait_id: str,
    user_id: str,
    prompt: str,
    aspect_ratio: str,
) -> None:
    """Multi-stage portrait pipeline. Uses the service-role client so it
    doesn't depend on the user's JWT outliving the original request."""
    db = service_client()

    def _patch(**fields: Any) -> None:
        db.table("portraits").update(fields).eq("id", portrait_id).execute()

    image_url: Optional[str] = None
    sprite_url: Optional[str] = None
    sprite_frames: Optional[list[str]] = None
    total_cost = 0.0

    # 1. Portrait — must succeed.
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
        total_cost += portrait_result.cost_usd or 0
        _patch(image_url=image_url)
    except Exception:
        log.error("Portrait painting failed:\n%s", traceback.format_exc())
        _patch(status="failed", stage="failed")
        return

    # 2. Sprite — optional, best-effort.
    try:
        _patch(stage="sculpting")
        sprite_result = await pixellab_provider.generate_sprite_from_image(
            portrait_url=image_url
        )
        if sprite_result is not None:
            sprite_url = storage.persist_image_bytes(
                user_id=user_id,
                blob=base64.b64decode(sprite_result.image_b64),
                suggested_name=f"sprite-{portrait_id}.png",
                content_type="image/png",
            )
            total_cost += sprite_result.cost_usd or 0
            _patch(sprite_url=sprite_url)
    except Exception as exc:
        log.warning("Sprite sculpting failed (continuing): %s", exc)
        sprite_result = None

    # 3. Animation — optional, best-effort, requires a successful sprite.
    if sprite_result is not None:
        try:
            _patch(stage="animating")
            anim = await pixellab_provider.animate_sprite(
                sprite_image_b64=sprite_result.image_b64,
                description=prompt,
            )
            if anim is not None:
                frame_urls: list[str] = []
                for idx, frame_b64 in enumerate(anim.frames_b64):
                    frame_url = storage.persist_image_bytes(
                        user_id=user_id,
                        blob=base64.b64decode(frame_b64),
                        suggested_name=f"sprite-{portrait_id}-frame-{idx}.png",
                        content_type="image/png",
                    )
                    frame_urls.append(frame_url)
                sprite_frames = frame_urls
                total_cost += anim.cost_usd or 0
        except Exception as exc:
            log.warning("Sprite animation failed (continuing): %s", exc)

    # 4. Done.
    _patch(
        sprite_frames=sprite_frames,
        cost_usd=total_cost,
        status="ready",
        stage="ready",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("", response_model=PortraitResponse)
def create_portrait(
    body: PortraitRequest,
    background: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
):
    """Insert a queued row, return immediately, and kick off the pipeline."""
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

    # BackgroundTasks awaits async callables after the response is sent —
    # the client never waits on this.
    background.add_task(
        _run_pipeline, portrait_id, user.id, body.prompt, body.aspect_ratio
    )

    return PortraitResponse(
        id=portrait_id,
        character_id=body.character_id,
        image_url=None,
        sprite_url=None,
        sprite_frames=None,
        is_current=False,
        status="pending",
        stage="queued",
        prompt=body.prompt,
        model="fal-ai/flux-pro/v1.1-ultra",
        cost_usd=None,
    )


@router.get("", response_model=list[dict[str, Any]])
def list_portraits(
    user: CurrentUser = Depends(get_current_user),
    character_id: Optional[str] = None,
):
    db = user_client(user.token)
    q = db.table("portraits").select("*").order("created_at", desc=True)
    if character_id:
        q = q.eq("character_id", character_id)
    return q.limit(100).execute().data


@router.patch("/{portrait_id}/current", response_model=dict[str, Any])
def set_current_portrait(
    portrait_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    res = db.table("portraits").select("character_id").eq("id", portrait_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    character_id = res.data[0]["character_id"]
    if not character_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Portrait is not linked to a character.",
        )

    db.table("portraits").update({"is_current": False}).eq(
        "character_id", character_id
    ).eq("is_current", True).execute()
    updated = (
        db.table("portraits")
        .update({"is_current": True})
        .eq("id", portrait_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portrait not found")
    return updated.data[0]
