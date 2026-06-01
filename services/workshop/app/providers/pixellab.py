"""PixelLab — convert a generated portrait into a JRPG-style pixel art sprite,
then animate it into an idle loop.

We use v2 endpoints. `/v2/image-to-pixelart` is direct img2img: it takes the
Flux portrait we already painted and returns a pixel-art version with palette
quantization. Subject identity is preserved exactly because the input *is*
the character, no prompt-laundering through a vision model.

Optional: if `pixellab_api_key` is unset or `sprites_enabled` is false,
`generate_sprite_from_image` and `animate_sprite` return None so callers can
no-op gracefully.
"""
import base64
from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import settings


@dataclass
class SpriteResult:
    image_b64: str       # PNG, base64 (no data URL prefix)
    cost_usd: Optional[float]


@dataclass
class AnimationResult:
    frames_b64: list[str]   # each frame base64 PNG (no data URL prefix)
    cost_usd: Optional[float]


def enabled() -> bool:
    return settings.sprites_enabled and bool(settings.pixellab_api_key)


def _strip_data_url(b64: str) -> str:
    """PixelLab sometimes returns data URLs (`data:image/png;base64,...`);
    strip the prefix so callers can decode cleanly."""
    if "," in b64 and b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64


async def _fetch_b64(url: str) -> str:
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return base64.b64encode(resp.content).decode("ascii")


async def generate_sprite_from_image(
    portrait_url: str,
    input_size: int = 512,
) -> Optional[SpriteResult]:
    """Convert the just-painted portrait into a pixel-art sprite via
    /v2/image-to-pixelart. Identity is preserved by direct img2img."""
    if not enabled():
        return None

    portrait_b64 = await _fetch_b64(portrait_url)
    payload = {
        "image": {"type": "base64", "base64": portrait_b64, "format": "png"},
        "image_size": {"width": input_size, "height": input_size},
        "output_size": {"width": settings.sprite_size, "height": settings.sprite_size},
        "text_guidance_scale": 8.0,
    }
    headers = {
        "Authorization": f"Bearer {settings.pixellab_api_key}",
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(connect=15, read=180, write=60, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.pixellab_base_url.replace('/v1','/v2')}/image-to-pixelart",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    img = data.get("image") or {}
    b64 = img.get("base64") or data.get("image_base64")
    if not b64:
        raise RuntimeError(
            f"Unexpected image-to-pixelart response shape: keys={list(data)}"
        )
    return SpriteResult(image_b64=_strip_data_url(b64), cost_usd=0.05)


async def animate_sprite(
    sprite_image_b64: str,
    description: str,
    n_frames: Optional[int] = None,
) -> Optional[AnimationResult]:
    """Animate the static sprite into a short idle loop via
    /v2/animate-with-text-v3 (newer animation endpoint)."""
    if not enabled():
        return None
    n = n_frames or settings.sprite_animation_frames

    payload = {
        "image": {"type": "base64", "base64": sprite_image_b64, "format": "png"},
        "image_size": {"width": settings.sprite_size, "height": settings.sprite_size},
        "text_prompt": (
            f"{description}. Subtle idle breathing animation — gentle vertical "
            "bob, slight shoulder rise and fall, eyes blinking once. Looping."
        ),
        "n_frames": n,
        "view": "side",
        "action": "idle",
        "direction": "east",
    }
    headers = {
        "Authorization": f"Bearer {settings.pixellab_api_key}",
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(connect=15, read=240, write=60, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.pixellab_base_url.replace('/v1','/v2')}/animate-with-text-v3",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    # Defensive — PixelLab may return frames under different keys.
    frames: list[str] = []
    if isinstance(data.get("images"), list):
        for f in data["images"]:
            if isinstance(f, dict) and "base64" in f:
                frames.append(_strip_data_url(f["base64"]))
            elif isinstance(f, str):
                frames.append(_strip_data_url(f))
    elif isinstance(data.get("frames"), list):
        for f in data["frames"]:
            if isinstance(f, dict) and "base64" in f:
                frames.append(_strip_data_url(f["base64"]))
            elif isinstance(f, str):
                frames.append(_strip_data_url(f))
    frames = [f for f in frames if f]
    if not frames:
        raise RuntimeError(
            f"Unexpected animate-with-text-v3 response: keys={list(data)}"
        )
    return AnimationResult(frames_b64=frames, cost_usd=0.15)
