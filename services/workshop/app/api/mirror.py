"""Magic Mirror — async pipeline: portrait → vision description → character
sprite → idle animation.

POST returns immediately; the work runs in a FastAPI BackgroundTask that
updates the row stage-by-stage. The frontend subscribes via Supabase
Realtime and renders a progress bar.

Stages:
  queued      — row inserted
  painting    — Flux is painting the portrait
  describing  — Claude Vision is summarizing the portrait
  sculpting   — PixelLab is generating the character sprite (8 directions)
  animating   — PixelLab is generating idle frames
  ready       — all done
  failed      — portrait failed (sprite/animation failures degrade gracefully)
"""
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
from ..providers import vision as vision_provider

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
    db = service_client()

    def _patch(**fields: Any) -> None:
        db.table("portraits").update(fields).eq("id", portrait_id).execute()

    image_url: Optional[str] = None
    sprite_url: Optional[str] = None
    sprite_frames: Optional[list[str]] = None
    total_cost = 0.0

    # 1. PORTRAIT (must succeed)
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

    # If sprites are off, we're done — give the user their portrait.
    if not pixellab_provider.enabled():
        _patch(status="ready", stage="ready", cost_usd=total_cost)
        return

    # 2. VISION DESCRIPTION (sprite-ready summary of the portrait)
    sprite_description = prompt
    try:
        _patch(stage="describing")
        sprite_description = await vision_provider.describe_for_sprite(image_url)
    except Exception as exc:
        log.warning("Vision step failed (falling back to original prompt): %s", exc)

    # 3. CHARACTER SPRITE (PixelLab create-character-with-8-directions, async)
    pixellab_character_id: Optional[str] = None
    try:
        _patch(stage="sculpting")
        character_result = await pixellab_provider.generate_character_sprite(
            description=sprite_description
        )
        if character_result is not None and character_result.south_image_url:
            sprite_url = await storage.persist_image(
                user_id=user_id,
                source_url=character_result.south_image_url,
                suggested_name=f"sprite-{portrait_id}.png",
            )
            pixellab_character_id = character_result.character_id
            total_cost += character_result.cost_usd or 0
            _patch(sprite_url=sprite_url)
    except Exception as exc:
        log.warning("Sprite sculpting failed (continuing without sprite): %s", exc)
        character_result = None

    # 4. IDLE ANIMATION (only if sprite succeeded)
    if pixellab_character_id:
        try:
            _patch(stage="animating")
            anim = await pixellab_provider.animate_character_idle(pixellab_character_id)
            if anim is not None and anim.frame_urls:
                frame_urls: list[str] = []
                for idx, frame_url in enumerate(anim.frame_urls):
                    persisted = await storage.persist_image(
                        user_id=user_id,
                        source_url=frame_url,
                        suggested_name=f"sprite-{portrait_id}-frame-{idx}.png",
                    )
                    frame_urls.append(persisted)
                sprite_frames = frame_urls
                total_cost += anim.cost_usd or 0
        except Exception as exc:
            log.warning("Sprite animation failed (continuing without frames): %s", exc)

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
