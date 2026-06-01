"""Suno (via reseller, e.g. sunoapi.com) — generate a song from lyrics + genre.

Note: Suno does not publish a first-party API. We talk to a reseller that proxies
Suno requests. The exact endpoints below assume sunoapi.com's v1 shape; swap
when picking a different reseller.
"""
from dataclasses import dataclass
from typing import Optional

import httpx

from ..config import settings


@dataclass
class SunoResult:
    audio_url: str
    duration_s: Optional[int]
    cost_usd: Optional[float]


async def generate_song(lyrics: str, genre: str, title: str) -> SunoResult:
    if not settings.suno_api_key:
        raise RuntimeError("SUNO_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {settings.suno_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "prompt": lyrics,
        "tags": genre,
        "title": title,
        "make_instrumental": False,
        "wait_audio": True,
    }

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            f"{settings.suno_base_url}/generate",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    # Reseller responses vary; this is the sunoapi.com shape. Defensive defaults.
    track = data["data"][0] if isinstance(data.get("data"), list) else data
    return SunoResult(
        audio_url=track.get("audio_url") or track["audio"]["url"],
        duration_s=int(track.get("duration", 0)) or None,
        cost_usd=0.05,
    )
