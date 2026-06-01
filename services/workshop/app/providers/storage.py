"""Supabase Storage helpers — mirror externally hosted assets into our buckets
so we control retention and serve via the same CDN as the rest of the app.
"""
import httpx

from ..config import settings
from ..db import service_client


def _public_url(bucket: str, path: str) -> str:
    return f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{path}"


async def _download(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def persist_image(user_id: str, source_url: str, suggested_name: str) -> str:
    blob = await _download(source_url)
    path = f"{user_id}/{suggested_name}"
    sb = service_client()
    sb.storage.from_(settings.portrait_bucket).upload(
        path=path,
        file=blob,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )
    return _public_url(settings.portrait_bucket, path)


async def persist_audio(user_id: str, source_url: str, suggested_name: str) -> str:
    blob = await _download(source_url)
    path = f"{user_id}/{suggested_name}"
    sb = service_client()
    sb.storage.from_(settings.song_bucket).upload(
        path=path,
        file=blob,
        file_options={"content-type": "audio/mpeg", "upsert": "true"},
    )
    return _public_url(settings.song_bucket, path)
