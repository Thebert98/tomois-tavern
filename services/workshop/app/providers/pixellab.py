"""PixelLab — generate a JRPG-style pixel sprite from a text description.

PixelLab's `generate-image-pixflux` produces true low-res pixel art with a
quantized palette. We *don't* hand it the Flux portrait as an init_image:
PixelLab's init_image biases starting noise, not subject identity, so the
text prompt (race, class, equipment) is what makes the sprite recognizably
the same character.

Optional: if `pixellab_api_key` is unset, `generate_sprite` returns None and
the caller skips sprite generation entirely.
"""
from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import settings


@dataclass
class SpriteResult:
    image_b64: str   # PNG bytes, base64-encoded (no data URL prefix)
    cost_usd: Optional[float]


@dataclass
class AnimationResult:
    frames_b64: list[str]   # each frame is base64-encoded PNG
    cost_usd: Optional[float]


def enabled() -> bool:
    return settings.sprites_enabled and bool(settings.pixellab_api_key)


async def generate_sprite(description: str) -> Optional[SpriteResult]:
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

    headers = {
        "Authorization": f"Bearer {settings.pixellab_api_key}",
        "Content-Type": "application/json",
    }
    # PixelLab's pixflux is synchronous but can run 60-180s for image-
    # conditioned requests. Generous timeout, fast connect.
    timeout = httpx.Timeout(connect=15, read=120, write=60, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
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


async def generate_idle_animation(
    sprite_image_b64: str,
    description: str,
    n_frames: Optional[int] = None,
) -> Optional[AnimationResult]:
    """Animate the sprite into a short idle loop (subtle breathing / bob),
    for the party screen hover effect. Returns None when sprites are off.

    PixelLab's animate-with-text takes the static sprite as a reference and
    a short description of the motion, and produces N frames that can be
    cycled client-side.
    """
    if not enabled():
        return None
    n = n_frames or settings.sprite_animation_frames
    payload = {
        "image": {"type": "base64", "base64": sprite_image_b64},
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
    # Animation produces N frames in one call — give it real time to run.
    timeout = httpx.Timeout(connect=15, read=240, write=60, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.pixellab_base_url}/animate-with-text",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    # PixelLab returns either {"images": [{"base64": ...}, ...]} or
    # {"frames": ["...","..."]}. Handle both.
    frames = []
    if isinstance(data.get("images"), list):
        for f in data["images"]:
            if isinstance(f, dict) and "base64" in f:
                frames.append(f["base64"])
            elif isinstance(f, str):
                frames.append(f)
    elif isinstance(data.get("frames"), list):
        frames = [f if isinstance(f, str) else f.get("base64") for f in data["frames"]]
    frames = [f for f in frames if f]
    if not frames:
        raise RuntimeError(f"Unexpected PixelLab animation response: keys={list(data)}")
    # Each animated generation is ~$0.15-0.20.
    return AnimationResult(frames_b64=frames, cost_usd=0.15)
