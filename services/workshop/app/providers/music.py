"""Unified text-to-song provider.

Background — why this exists:

  The Bard's Stage originally pointed at Suno through ``sunoapi.com``,
  an unofficial reseller. Suno's own API has stayed gated to a small
  set of partners; the wrappers come and go and break the
  contract every time Suno changes versions. We swap them for
  Replicate's hosted MiniMax Music — that's a first-party Replicate
  model with a stable HTTP contract, predictable per-second pricing,
  and real sung vocals over instrumental backing.

Provider precedence at runtime:

  1. ``REPLICATE_API_TOKEN`` set → use Replicate's MiniMax Music.
  2. Else ``SUNO_API_KEY`` set → fall through to the legacy ``suno``
     reseller for backwards compat. We don't recommend it.
  3. Otherwise raise a friendly error the route maps to a 502.

Output shape is identical across providers (``SongResult``).
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from ..config import settings


@dataclass
class SongResult:
    audio_url: str
    duration_s: Optional[int]
    cost_usd: Optional[float]
    model: str


# ---- Replicate / MiniMax Music ----------------------------------------------
#
# Replicate's MiniMax Music model documentation:
#   https://replicate.com/minimax/music-2.6
#
# Input: { lyrics: str, song_description: str (style + genre + vibe) }
# Output: an audio URL the player can stream / we mirror into Storage.
#
# We talk to the Replicate REST API directly instead of importing the
# ``replicate`` SDK — fewer deps to track and the request/response are
# small enough to model by hand. The polling pattern matches the SDK's.

_REPLICATE_MODEL = "minimax/music-2.6"
_REPLICATE_HOST = "https://api.replicate.com/v1"
_POLL_INTERVAL_S = 2
_MAX_POLL_S = 180


async def _replicate_song(lyrics: str, genre: str, title: str) -> SongResult:
    headers = {
        "Authorization": f"Bearer {settings.replicate_api_token}",
        "Content-Type": "application/json",
    }
    description = ", ".join(
        part for part in (title, genre, "tavern bard ballad with sung vocals") if part
    )
    payload = {
        "input": {
            "lyrics": lyrics[:3500],  # MiniMax caps at 3.5k chars
            "song_description": description,
        }
    }

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Kick off the prediction.
        create = await client.post(
            f"{_REPLICATE_HOST}/models/{_REPLICATE_MODEL}/predictions",
            json=payload,
            headers=headers,
        )
        create.raise_for_status()
        pred = create.json()
        pred_id = pred["id"]

        # 2. Poll until succeeded, failed, or our ceiling.
        elapsed = 0
        while pred.get("status") in ("starting", "processing"):
            if elapsed > _MAX_POLL_S:
                raise RuntimeError(
                    f"MiniMax Music timed out after {_MAX_POLL_S}s — "
                    f"prediction id {pred_id}"
                )
            await asyncio.sleep(_POLL_INTERVAL_S)
            elapsed += _POLL_INTERVAL_S
            check = await client.get(f"{_REPLICATE_HOST}/predictions/{pred_id}", headers=headers)
            check.raise_for_status()
            pred = check.json()

    if pred.get("status") != "succeeded":
        err = pred.get("error") or pred.get("status")
        raise RuntimeError(f"MiniMax Music failed: {err}")

    output: Any = pred.get("output")
    audio_url = _audio_from_output(output)
    if not audio_url:
        raise RuntimeError("MiniMax Music returned no audio url")

    # MiniMax bills ~$0.05/song on Replicate at the time of writing; the
    # actual amount comes back from the API in ``metrics``.
    metrics = pred.get("metrics") or {}
    return SongResult(
        audio_url=audio_url,
        duration_s=metrics.get("audio_duration_s") or None,
        cost_usd=metrics.get("predict_time")
        and round(metrics["predict_time"] * 0.000725, 5)
        or 0.05,
        model=_REPLICATE_MODEL,
    )


def _audio_from_output(output: Any) -> Optional[str]:
    """Normalize MiniMax/Replicate output to a single audio URL.

    Output can be a bare string, a list of strings, or an object with
    nested ``audio`` keys. Handle the common shapes defensively.
    """
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        first = output[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("audio") or first.get("url")
    if isinstance(output, dict):
        return output.get("audio") or output.get("url")
    return None


# ---- Suno reseller (legacy) -------------------------------------------------


async def _suno_song(lyrics: str, genre: str, title: str) -> SongResult:
    """Legacy fallback. The old Suno reseller wrapper, kept for
    backwards compatibility with deploys that still have SUNO_API_KEY
    set. Prefer Replicate / MiniMax Music.
    """
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
            f"{settings.suno_base_url}/generate", json=payload, headers=headers
        )
        resp.raise_for_status()
        data = resp.json()
    track = data["data"][0] if isinstance(data.get("data"), list) else data
    return SongResult(
        audio_url=track.get("audio_url") or track["audio"]["url"],
        duration_s=int(track.get("duration", 0)) or None,
        cost_usd=0.05,
        model="suno-reseller",
    )


# ---- Public entry point -----------------------------------------------------


async def generate_song(lyrics: str, genre: str, title: str) -> SongResult:
    """Pick a provider and produce a sung track.

    Raises ``RuntimeError`` with a friendly message when no provider
    credentials are configured. The bard route translates that to a
    502 with tavern copy ("the bard's lute is unstrung").
    """
    if settings.replicate_api_token:
        return await _replicate_song(lyrics, genre, title)
    if settings.suno_api_key:
        return await _suno_song(lyrics, genre, title)
    raise RuntimeError(
        "No music provider configured — set REPLICATE_API_TOKEN (preferred) "
        "or SUNO_API_KEY in the workshop env."
    )
