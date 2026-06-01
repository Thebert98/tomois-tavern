"""Claude Vision — extract a sprite-ready visual description from a portrait.

PixelLab's character endpoints are text-only. The Flux portrait carries
visual details (face features, exact clothing, hair, weapon shape) richer
than the user's original prompt. Vision bridges them: portrait → concise
character description → PixelLab.
"""
import logging
from typing import Optional

import anthropic
import httpx

from ..config import settings

log = logging.getLogger("workshop.vision")
_client: Optional[anthropic.AsyncAnthropic] = None


def _anthropic() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


SYSTEM = (
    "You are a pixel-art character sheet artist briefing a sprite maker. "
    "Given a portrait, write 2-3 sentences describing the SUBJECT in terms a "
    "pixel-art sprite generator can render at small size: race, body type, "
    "hair color and style, facial hair, distinctive features, clothing/armor "
    "with main color, weapon if any. Skip background, lighting, mood. Avoid "
    "stylistic words ('painterly', 'cinematic'). Output the description only."
)


async def describe_for_sprite(portrait_url: str) -> str:
    """Returns a compact, sprite-oriented character description."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(portrait_url)
        resp.raise_for_status()
        portrait_bytes = resp.content
    # Anthropic vision accepts base64-encoded image blocks.
    import base64
    b64 = base64.b64encode(portrait_bytes).decode("ascii")

    resp = await _anthropic().messages.create(
        model=settings.anthropic_model,
        max_tokens=180,
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Describe the character in this portrait for a pixel-art sprite.",
                    },
                ],
            }
        ],
    )
    description = resp.content[0].text.strip()
    log.info("Vision description: %s", description)
    return description
