"""PixelLab — generate a JRPG-style pixel sprite that resembles a reference portrait.

PixelLab's `generate-image-pixflux` endpoint takes a text description plus an
optional reference image, and returns a true low-res pixel art sprite with a
quantized palette. Image conditioning is what keeps the sprite resembling the
character in the Flux-painted portrait.

Optional: if `pixellab_api_key` is unset, `generate_sprite` returns None and the
caller skips sprite generation entirely.
"""
import base64
from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import settings


@dataclass
class SpriteResult:
    image_b64: str   # PNG bytes, base64-encoded (no data URL prefix)
    cost_usd: Optional[float]


def enabled() -> bool:
    return settings.sprites_enabled and bool(settings.pixellab_api_key)


async def _fetch_reference_b64(reference_url: str) -> str:
    """PixelLab accepts base64 reference images; mirror our portrait into that
    shape rather than handing them a (potentially-expiring) signed URL."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(reference_url)
        resp.raise_for_status()
        return base64.b64encode(resp.content).decode("ascii")


async def generate_sprite(
    description: str,
    reference_image_url: Optional[str] = None,
) -> Optional[SpriteResult]:
    """Generate a JRPG-style sprite. Returns None when the integration is
    disabled (no key) so callers can no-op gracefully."""
    if not enabled():
        return None

    payload: dict = {
        "description": description,
        "image_size": {"width": settings.sprite_size, "height": settings.sprite_size},
        "no_background": True,
        "outline": "single color black outline",
        "shading": "basic shading",
        "style": "pixel art",
        "view": "side",
    }
    if reference_image_url:
        payload["init_image"] = {
            "type": "base64",
            "base64": await _fetch_reference_b64(reference_image_url),
        }
        # 50-70 keeps subject identity from the reference while letting the
        # model commit to a clean pixel grid.
        payload["init_image_strength"] = 60

    headers = {
        "Authorization": f"Bearer {settings.pixellab_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            f"{settings.pixellab_base_url}/generate-image-pixflux",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    # PixelLab returns the image as base64 in `image.base64`.
    img = data.get("image") or {}
    b64 = img.get("base64") or data.get("image_base64")
    if not b64:
        raise RuntimeError(f"Unexpected PixelLab response shape: keys={list(data)}")
    # PixelLab pricing: ~$0.05-0.15 per generation depending on size.
    return SpriteResult(image_b64=b64, cost_usd=0.10)
