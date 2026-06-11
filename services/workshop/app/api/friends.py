"""Friends — invite by email, accept/reject, list.

Schema (from 0001_tavern_init.sql):
  friendships(requester_id, addressee_id, status, created_at)
  RLS: either party can read; requester inserts; either updates/deletes.

Friend lookups by email and id enrichment use SECURITY DEFINER helpers
defined in migration 0006.
"""
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator

from ..auth import CurrentUser, get_current_user
from ..db import user_client
from ..rate_limit import friend_invite_limit, limiter

router = APIRouter(prefix="/friends", tags=["friends"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class FriendInviteBody(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _check(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address.")
        return v.lower()


class FriendDTO(BaseModel):
    other_user_id: str
    other_email: Optional[str]
    status: str          # 'pending' | 'accepted' | 'blocked'
    direction: str       # 'incoming' | 'outgoing'
    created_at: Optional[str]


def _emails_for(db, ids: list[str]) -> dict[str, str]:
    """Resolve user ids to emails via the SECURITY DEFINER RPC.

    Defensive against PostgREST schema-cache hiccups (see parties.py
    for the longer note). Emails are non-critical enrichment; falling
    back to ``{}`` means the UI shows the uuid instead of the email
    but the endpoint still returns.
    """
    if not ids:
        return {}
    try:
        res = db.rpc("lookup_users_by_ids", {"p_ids": ids}).execute()
        return {row["id"]: row["email"] for row in (res.data or [])}
    except Exception:
        return {}


@router.get("", response_model=list[FriendDTO])
def list_friends(user: CurrentUser = Depends(get_current_user)):
    db = user_client(user.token)
    rows = db.table("friendships").select("*").execute().data or []
    other_ids = [
        r["addressee_id"] if r["requester_id"] == user.id else r["requester_id"]
        for r in rows
    ]
    emails = _emails_for(db, other_ids)
    out: list[FriendDTO] = []
    for r in rows:
        is_outgoing = r["requester_id"] == user.id
        other = r["addressee_id"] if is_outgoing else r["requester_id"]
        out.append(
            FriendDTO(
                other_user_id=other,
                other_email=emails.get(other),
                status=r["status"],
                direction="outgoing" if is_outgoing else "incoming",
                created_at=r.get("created_at"),
            )
        )
    return out


@router.post("", response_model=FriendDTO, status_code=status.HTTP_201_CREATED)
@limiter.limit(friend_invite_limit)
def invite_friend(
    request: Request,
    body: FriendInviteBody,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    lookup = db.rpc("lookup_user_by_email", {"p_email": body.email}).execute()
    addressee_id = lookup.data if isinstance(lookup.data, str) else None
    if not addressee_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No traveller answers to that email.",
        )
    if addressee_id == user.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You can't friend yourself.",
        )

    # Existing friendship in either direction?
    existing = (
        db.table("friendships")
        .select("*")
        .or_(
            f"and(requester_id.eq.{user.id},addressee_id.eq.{addressee_id}),"
            f"and(requester_id.eq.{addressee_id},addressee_id.eq.{user.id})"
        )
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A bond already exists between you two.",
        )

    inserted = (
        db.table("friendships")
        .insert(
            {
                "requester_id": user.id,
                "addressee_id": addressee_id,
                "status": "pending",
            }
        )
        .execute()
    )
    if not inserted.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Couldn't send the invitation.",
        )
    return FriendDTO(
        other_user_id=addressee_id,
        other_email=body.email,
        status="pending",
        direction="outgoing",
        created_at=inserted.data[0].get("created_at"),
    )


@router.post("/{other_user_id}/accept", response_model=FriendDTO)
def accept_friend(
    other_user_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Only the addressee can accept. The friendships PK is (requester,
    addressee); the requester is `other_user_id` and the addressee is us."""
    db = user_client(user.token)
    updated = (
        db.table("friendships")
        .update({"status": "accepted"})
        .eq("requester_id", other_user_id)
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .execute()
    )
    if not updated.data:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No pending invitation from that traveller.",
        )
    emails = _emails_for(db, [other_user_id])
    return FriendDTO(
        other_user_id=other_user_id,
        other_email=emails.get(other_user_id),
        status="accepted",
        direction="incoming",
        created_at=updated.data[0].get("created_at"),
    )


@router.delete("/{other_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(
    other_user_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Either side may end the friendship. Both possible direction-pairs
    are deleted by an OR on the composite PK."""
    db = user_client(user.token)
    db.table("friendships").delete().or_(
        f"and(requester_id.eq.{user.id},addressee_id.eq.{other_user_id}),"
        f"and(requester_id.eq.{other_user_id},addressee_id.eq.{user.id})"
    ).execute()
    return None
