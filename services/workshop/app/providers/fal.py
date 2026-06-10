"""fal.ai client — Flux 1.1 Pro for character portraits."""
import asyncio
from dataclasses import dataclass
from typing import Optional

import fal_client

from ..config import settings

# Flux Pro Ultra normally settles within 10-30 seconds; 120 s is a
# generous ceiling that protects us from a hung worker without cutting
# off slow-but-real generations. If fal.ai stalls past that, we mark
# the row failed and let the user re-cast.
_FAL_TIMEOUT_S = 120


@dataclass
class FalResult:
    image_url: str
    cost_usd: Optional[float]


async def generate_portrait(prompt: str, aspect_ratio: str = "3:4") -> FalResult:
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
    try:
        result = await asyncio.wait_for(handler.get(), timeout=_FAL_TIMEOUT_S)
    except asyncio.TimeoutError as exc:
        raise RuntimeError(
            f"fal.ai did not return a portrait within {_FAL_TIMEOUT_S}s"
        ) from exc
    image = result["images"][0]
    # Flux Pro Ultra is ~$0.06/image as of 2026-06.
    return FalResult(image_url=image["url"], cost_usd=0.06)
