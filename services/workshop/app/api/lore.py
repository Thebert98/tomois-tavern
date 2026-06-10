"""World lore — CRUD for the player's private lore corpus.

The bard sings about feats, parties, OR a lore entry. Phase 7 shipped
the first two scopes; lore was deferred because the table existed but
no CRUD routes did. This module fills that gap.

Schema (from 0001_tavern_init.sql):
  world_lore(id, user_id, title, body, created_at)
  RLS: owner-only (single ``for all`` policy in 0001).

The schema's RLS is the floor; this router stays thin and adds a 404
return when a delete matches no row (same pattern as parties /
characters / portraits).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..auth import CurrentUser, get_current_user
from ..db import user_client

router = APIRouter(prefix="/lore", tags=["lore"])


class LoreCreateBody(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=4000)


class LoreOut(BaseModel):
    id: str
    title: str
    body: str
    created_at: str | None = None


@router.get("", response_model=list[LoreOut])
def list_lore(user: CurrentUser = Depends(get_current_user)) -> list[dict[str, Any]]:
    db = user_client(user.token)
    res = (
        db.table("world_lore")
        .select("id,title,body,created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("", response_model=LoreOut, status_code=status.HTTP_201_CREATED)
def create_lore(
    body: LoreCreateBody,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    db = user_client(user.token)
    res = (
        db.table("world_lore")
        .insert({"user_id": user.id, "title": body.title, "body": body.body})
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Couldn't ink that lore into the book.",
        )
    return res.data[0]


@router.delete("/{lore_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_lore(
    lore_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> None:
    db = user_client(user.token)
    res = db.table("world_lore").delete().eq("id", lore_id).execute()
    if not res.data:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "That page isn't in the book.",
        )
    return None
