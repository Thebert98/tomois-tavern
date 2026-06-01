"""Workshop — FastAPI entrypoint for Magic Mirror (portraits) and Tavern Bard (songs)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .api import mirror, bard

app = FastAPI(title="Tomoi's Tavern Workshop", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mirror.router)
app.include_router(bard.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
