"""PixelLab v2 — full character sprite generation + animation.

Pipeline target: FFVII Pixel Reunion-style chibi sprites with multiple
directions, animated into an idle cycle. Each step is an async PixelLab job
we poll until completion.

Endpoints used:
  POST /v2/create-character-with-8-directions  →  character_id (background)
  GET  /v2/characters/{character_id}           →  rotation URLs
  POST /v2/animate-character                   →  job_id (background)
  GET  /v2/background-jobs/{job_id}            →  animation frames

The /image-to-pixelart endpoint we used earlier is the wrong tool for this
job — it converts ANY image to "pixel art style" but preserves composition,
so a head-and-shoulders portrait gives back a head-and-shoulders sprite.
For real game sprites we need a generator that *makes characters*, which is
what create-character-with-8-directions does.
"""
import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from ..config import settings

log = logging.getLogger("workshop.pixellab")


@dataclass
class CharacterResult:
    character_id: str
    south_image_url: Optional[str]   # the "front" pose used for portraits/gallery
    rotation_urls: dict[str, str]    # direction → image url
    cost_usd: Optional[float]


@dataclass
class AnimationFramesResult:
    frame_urls: list[str]            # direct CDN URLs (no base64)
    cost_usd: Optional[float]


# -- helpers -----------------------------------------------------------------

def _v2_url(path: str) -> str:
    """Build a v2 endpoint URL regardless of which version the user set."""
    base = settings.pixellab_base_url.rstrip("/")
    if base.endswith("/v1") or base.endswith("/v2"):
        base = base.rsplit("/", 1)[0]
    return f"{base}/v2{path}"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.pixellab_api_key}",
        "Content-Type": "application/json",
    }


def enabled() -> bool:
    return settings.sprites_enabled and bool(settings.pixellab_api_key)


# -- character generation ----------------------------------------------------

# Style hints baked into every character generation so we get a consistent
# FFVII Pixel Reunion-ish look across all heroes. Values must match PixelLab's
# enums exactly — see /v2/openapi.json schemas Outline / Shading / Detail /
# CameraView / CharacterProportionsPreset.
_STYLE_HINTS: dict[str, Any] = {
    "outline": "single color black outline",   # Outline enum
    "shading": "medium shading",               # Shading enum
    "detail": "medium detail",                 # Detail enum
    "view": "side",                            # CameraView enum
    "isometric": False,
    "template_id": "mannequin",                # humanoid skeleton
    "mode": "standard",
    "proportions": {"type": "preset", "name": "chibi"},
}


async def _create_character(description: str) -> str:
    """Submit a character generation job. Returns character_id immediately."""
    payload: dict[str, Any] = {
        "description": description,
        "image_size": {"width": settings.sprite_size, "height": settings.sprite_size},
        **_STYLE_HINTS,
    }
    timeout = httpx.Timeout(connect=15, read=60, write=60, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            _v2_url("/create-character-with-8-directions"),
            json=payload,
            headers=_headers(),
        )
        if resp.status_code >= 400:
            # Surface the validation detail (PixelLab returns FastAPI-style
            # `detail` arrays) so we can fix payload mistakes from the log.
            log.error(
                "PixelLab create-character %s body: %s",
                resp.status_code, resp.text[:500],
            )
            resp.raise_for_status()
        data = resp.json()
    character_id = data.get("character_id") or data.get("id") or data.get("character", {}).get("id")
    if not character_id:
        raise RuntimeError(f"create-character returned no id: keys={list(data)}")
    return character_id


async def _get_character(character_id: str) -> dict[str, Any]:
    timeout = httpx.Timeout(connect=15, read=30, write=30, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(
            _v2_url(f"/characters/{character_id}"),
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def _wait_for_character(
    character_id: str, max_seconds: int = 600, interval_seconds: float = 6.0
) -> dict[str, Any]:
    """Poll the character until status is completed/failed or timeout hits."""
    waited = 0.0
    while waited < max_seconds:
        info = await _get_character(character_id)
        status = (info.get("status") or "").lower()
        if status in ("completed", "ready", "done"):
            return info
        if status in ("failed", "error"):
            raise RuntimeError(f"PixelLab character {character_id} failed: {info}")
        await asyncio.sleep(interval_seconds)
        waited += interval_seconds
    raise TimeoutError(f"PixelLab character {character_id} did not finish in {max_seconds}s")


def _extract_rotation_urls(info: dict[str, Any]) -> dict[str, str]:
    """The character payload exposes rotations under a few possible shapes
    across PixelLab's docs — be defensive."""
    rotations = info.get("rotations") or info.get("rotation_urls") or info.get("images") or {}
    if isinstance(rotations, dict):
        return {k: v if isinstance(v, str) else v.get("url", "") for k, v in rotations.items()}
    if isinstance(rotations, list):
        # Fallback: list of {direction, url}
        out: dict[str, str] = {}
        for r in rotations:
            if isinstance(r, dict):
                d = r.get("direction") or r.get("name")
                u = r.get("url") or r.get("image_url")
                if d and u:
                    out[d] = u
        return out
    return {}


async def generate_character_sprite(description: str) -> Optional[CharacterResult]:
    """Create + wait for an 8-direction character sprite. Returns None if
    sprites are disabled at the config level."""
    if not enabled():
        return None
    character_id = await _create_character(description)
    log.info("PixelLab character queued: %s", character_id)
    info = await _wait_for_character(character_id)
    rotations = _extract_rotation_urls(info)
    south = rotations.get("south") or next(iter(rotations.values()), None)
    return CharacterResult(
        character_id=character_id,
        south_image_url=south,
        rotation_urls=rotations,
        cost_usd=0.40,
    )


# -- animation ---------------------------------------------------------------

async def _animate_character(
    character_id: str, template_animation_id: str = "idle"
) -> str:
    """Kick off an animation job; returns job_id."""
    payload: dict[str, Any] = {
        "character_id": character_id,
        "mode": "template",
        "template_animation_id": template_animation_id,
        "directions": ["south"],
    }
    timeout = httpx.Timeout(connect=15, read=60, write=60, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            _v2_url("/animate-character"),
            json=payload,
            headers=_headers(),
        )
        if resp.status_code >= 400:
            log.error(
                "PixelLab animate-character %s body: %s",
                resp.status_code, resp.text[:500],
            )
            resp.raise_for_status()
        data = resp.json()
    job_id = (
        data.get("job_id")
        or data.get("id")
        or (data.get("jobs", [{}])[0].get("id") if isinstance(data.get("jobs"), list) else None)
    )
    if not job_id:
        raise RuntimeError(f"animate-character returned no job id: keys={list(data)}")
    return job_id


async def _get_job(job_id: str) -> dict[str, Any]:
    timeout = httpx.Timeout(connect=15, read=30, write=30, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(
            _v2_url(f"/background-jobs/{job_id}"),
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def _wait_for_job(
    job_id: str, max_seconds: int = 600, interval_seconds: float = 6.0
) -> dict[str, Any]:
    waited = 0.0
    while waited < max_seconds:
        info = await _get_job(job_id)
        status = (info.get("status") or "").lower()
        if status in ("completed", "done", "ready"):
            return info
        if status in ("failed", "error"):
            raise RuntimeError(f"PixelLab job {job_id} failed: {info}")
        await asyncio.sleep(interval_seconds)
        waited += interval_seconds
    raise TimeoutError(f"PixelLab job {job_id} did not finish in {max_seconds}s")


def _extract_frame_urls(job: dict[str, Any]) -> list[str]:
    """Be tolerant of result shape — frames may live at several paths."""
    result = job.get("result") or job
    for key in ("frames", "animation_frames", "images", "urls"):
        frames = result.get(key)
        if isinstance(frames, list) and frames:
            out: list[str] = []
            for f in frames:
                if isinstance(f, str):
                    out.append(f)
                elif isinstance(f, dict):
                    u = f.get("url") or f.get("image_url") or f.get("image", {}).get("url")
                    if u:
                        out.append(u)
            if out:
                return out
    return []


async def animate_character_idle(character_id: str) -> Optional[AnimationFramesResult]:
    """Animate the character on PixelLab's `idle` template; returns frame URLs."""
    if not enabled():
        return None
    job_id = await _animate_character(character_id, template_animation_id="idle")
    log.info("PixelLab animation queued: %s (character=%s)", job_id, character_id)
    job = await _wait_for_job(job_id)
    frames = _extract_frame_urls(job)
    if not frames:
        raise RuntimeError(f"animate-character returned no frames: {job.keys()}")
    return AnimationFramesResult(frame_urls=frames, cost_usd=0.30)
