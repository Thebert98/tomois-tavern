"""Workshop — FastAPI entrypoint for Magic Mirror (portraits) and Tavern Bard (songs)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .api import mirror, bard, friends, parties

app = FastAPI(title="Tomoi's Tavern Workshop", version="0.1.0")

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
