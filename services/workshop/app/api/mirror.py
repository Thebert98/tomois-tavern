"""Magic Mirror — POST /portraits to generate a character portrait via Flux 1.1 Pro on fal.ai."""
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..auth import CurrentUser, get_current_user
from ..db import user_client
from ..providers import fal as fal_provider
from ..providers import storage

router = APIRouter(prefix="/portraits", tags=["mirror"])


class PortraitRequest(BaseModel):
    character_id: Optional[str] = None
    prompt: str
    # Optional: aspect ratio, style, etc. Add as we iterate.
    aspect_ratio: str = "3:4"


class PortraitResponse(BaseModel):
    id: str
    image_url: Optional[str]
    status: str
    prompt: str
    model: str
    cost_usd: Optional[float]


@router.post("", response_model=PortraitResponse)
async def create_portrait(
    body: PortraitRequest,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)

    # Insert pending row so the UI has something to poll/show immediately.
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

    try:
        result = await fal_provider.generate_portrait(
            prompt=body.prompt,
            aspect_ratio=body.aspect_ratio,
        )
    except Exception as exc:
        db.table("portraits").update({"status": "failed"}).eq("id", portrait_id).execute()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Portrait generation failed: {exc}",
        ) from exc

    # Mirror the fal-hosted asset into Supabase Storage so we control retention.
    public_url = await storage.persist_image(
        user_id=user.id,
        source_url=result.image_url,
        suggested_name=f"portrait-{portrait_id}.jpg",
    )

    db.table("portraits").update(
        {
            "image_url": public_url,
            "status": "ready",
            "cost_usd": result.cost_usd,
        }
    ).eq("id", portrait_id).execute()

    return PortraitResponse(
        id=portrait_id,
        image_url=public_url,
        status="ready",
        prompt=body.prompt,
        model="fal-ai/flux-pro/v1.1-ultra",
        cost_usd=result.cost_usd,
    )


@router.get("", response_model=list[dict[str, Any]])
def list_portraits(user: CurrentUser = Depends(get_current_user)):
    db = user_client(user.token)
    res = (
        db.table("portraits")
        .select("*")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data
