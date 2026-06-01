"""Magic Mirror — character portraits + matching pixel sprites via fal.ai."""
import asyncio
import logging
import traceback
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..db import user_client
from ..providers import fal as fal_provider
from ..providers import storage

router = APIRouter(prefix="/portraits", tags=["mirror"])
log = logging.getLogger("workshop.mirror")


class PortraitRequest(BaseModel):
    character_id: str  # required — the mirror must know whose face to seek
    prompt: str
    aspect_ratio: str = "3:4"


class PortraitResponse(BaseModel):
    id: str
    character_id: str
    image_url: Optional[str]
    sprite_url: Optional[str]
    is_current: bool
    status: str
    prompt: str
    model: str
    cost_usd: Optional[float]


@router.post("", response_model=PortraitResponse)
async def create_portrait(
    body: PortraitRequest,
    user: CurrentUser = Depends(get_current_user),
):
    portrait_id: Optional[str] = None
    try:
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
                }
            )
            .execute()
        )
        portrait_id = pending.data[0]["id"]

        # Generate the portrait and the matching sprite in parallel — two calls
        # to the same model, so doing them serially would double the wait.
        portrait_task = fal_provider.generate_portrait(
            prompt=body.prompt, aspect_ratio=body.aspect_ratio
        )
        sprite_task = fal_provider.generate_sprite(prompt=body.prompt)
        portrait_result, sprite_result = await asyncio.gather(portrait_task, sprite_task)

        # Persist both into Supabase Storage so we control retention.
        image_url, sprite_url = await asyncio.gather(
            storage.persist_image(
                user_id=user.id,
                source_url=portrait_result.image_url,
                suggested_name=f"portrait-{portrait_id}.jpg",
            ),
            storage.persist_image(
                user_id=user.id,
                source_url=sprite_result.image_url,
                suggested_name=f"sprite-{portrait_id}.jpg",
            ),
        )

        db.table("portraits").update(
            {
                "image_url": image_url,
                "sprite_url": sprite_url,
                "status": "ready",
                "cost_usd": (portrait_result.cost_usd or 0)
                + (sprite_result.cost_usd or 0),
            }
        ).eq("id", portrait_id).execute()

        return PortraitResponse(
            id=portrait_id,
            character_id=body.character_id,
            image_url=image_url,
            sprite_url=sprite_url,
            is_current=False,
            status="ready",
            prompt=body.prompt,
            model="fal-ai/flux-pro/v1.1-ultra",
            cost_usd=(portrait_result.cost_usd or 0) + (sprite_result.cost_usd or 0),
        )
    except Exception as exc:
        log.error("Portrait generation failed:\n%s", traceback.format_exc())
        if portrait_id:
            try:
                user_client(user.token).table("portraits").update(
                    {"status": "failed"}
                ).eq("id", portrait_id).execute()
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Portrait generation failed: {type(exc).__name__}: {exc}",
        ) from exc


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
    """Mark this portrait as the character's active one. Clears any previous
    is_current=true for the same character (partial-unique index would
    otherwise reject the update)."""
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

    # Clear current on siblings, then set on this one.
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
