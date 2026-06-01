"""fal.ai client — Flux 1.1 Pro for character portraits."""
from dataclasses import dataclass
from typing import Optional

import fal_client

from ..config import settings


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
    result = await handler.get()
    image = result["images"][0]
    # Flux Pro Ultra is ~$0.06/image as of 2026-06.
    return FalResult(image_url=image["url"], cost_usd=0.06)
