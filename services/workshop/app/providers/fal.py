"""fal.ai client — Flux 1.1 Pro for character portraits and matching sprites."""
from dataclasses import dataclass
from typing import Optional

import fal_client

from ..config import settings

# Sprite styling appended to the user's portrait prompt — keeps the *subject*
# identical but swaps the rendering style. Square aspect for party UI tokens.
_SPRITE_STYLE = (
    "Render as a 32-bit pixel art sprite, full-body, facing forward, "
    "limited palette, crisp pixels, transparent flat background, centered, "
    "game-asset style — like a hero portrait for a top-down RPG."
)


@dataclass
class FalResult:
    image_url: str
    cost_usd: Optional[float]


async def _run(prompt: str, aspect_ratio: str) -> FalResult:
    if not settings.fal_key:
        raise RuntimeError("FAL_KEY is not set")
    handler = await fal_client.submit_async(
        settings.portrait_model,
        arguments={
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "num_images": 1,
            "enable_safety_checker": True,
        },
    )
    result = await handler.get()
    image = result["images"][0]
    # Flux Pro Ultra is ~$0.06/image as of 2026-06.
    return FalResult(image_url=image["url"], cost_usd=0.06)


async def generate_portrait(prompt: str, aspect_ratio: str = "3:4") -> FalResult:
    return await _run(prompt, aspect_ratio)


async def generate_sprite(prompt: str) -> FalResult:
    """Generate a pixel-art sprite of the same character described by `prompt`."""
    sprite_prompt = f"{prompt}\n\n{_SPRITE_STYLE}"
    return await _run(sprite_prompt, aspect_ratio="1:1")
