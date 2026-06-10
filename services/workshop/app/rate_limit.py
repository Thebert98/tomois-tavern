"""Per-user rate limits for the workshop.

The Mirror calls fal.ai (~$0.06/portrait) and the Bard calls Suno
(~$0.10/song) — both real money on every request. ReRoll already runs
a 20/day cap; this module gives the workshop a matching set of limits
so a runaway client or an enthusiastic loop can't drain credit.

Friend invites get a separate hourly cap to bound the email-enumeration
tradeoff documented in ``0006_user_lookup.sql`` (RPC ``lookup_user_by_email``
is necessarily broad; the slowapi cap turns enumeration from "free" into
"slow + expensive").

Key function mirrors ReRoll's pattern: prefer the verified JWT
``sub`` claim, fall back to remote IP. Verifying the signature here
matters because slowapi runs before our auth dependency — without
verification, a forged token would shift another user's bucket.
"""
from __future__ import annotations

import jwt
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from .auth import _decode
from .config import settings


def _user_key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:]
        try:
            payload = _decode(token)
            sub = payload.get("sub")
            if sub:
                return f"user:{sub}"
        except jwt.PyJWTError:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_user_key)


# ---- Per-route limit strings ----------------------------------------------
# Configurable via env so prod can tune without a deploy.
def portrait_limit() -> str:
    return f"{settings.daily_portrait_limit}/day"


def song_limit() -> str:
    return f"{settings.daily_song_limit}/day"


def friend_invite_limit() -> str:
    return f"{settings.hourly_friend_invite_limit}/hour"
