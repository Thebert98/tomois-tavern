"""Workshop — FastAPI entrypoint for Magic Mirror (portraits) and Tavern Bard (songs)."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from .config import settings
from .api import bard, friends, lore, mirror, parties
from .rate_limit import limiter

app = FastAPI(title="Tomoi's Tavern Workshop", version="0.1.0")

# Rate limiting (per-user daily / hourly caps on paid + lookup endpoints).
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
def _rate_limit_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Tavern-flavoured 429 copy. Each route maps the message to its
    own room: 'mirror is dim', 'bard is weary', 'raven won't fly'."""
    # The route knows its own metaphor; we attach a generic fallback here.
    return JSONResponse(
        status_code=429,
        content={"detail": f"Too many requests — {exc.detail}."},
    )

# FRONTEND_ORIGIN may be a comma-separated list — production Vercel,
# the tavern app, localhost during dev, etc.
_allowed_origins = [
    o.strip() for o in settings.frontend_origin.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mirror.router)
app.include_router(bard.router)
app.include_router(friends.router)
app.include_router(parties.router)
app.include_router(lore.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
