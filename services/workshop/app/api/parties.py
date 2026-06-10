"""Parties — create, list, manage members.

Schema (from 0001_tavern_init.sql):
  parties(id, owner_id, name, created_at)
  party_members(party_id, user_id, character_id, role, joined_at)

RLS: owner or member can read; owner writes parties; members manage
their own row, owner manages everyone's.

Members may be added only if a friendship exists between the requesting
user (party owner) and the prospective member — checked explicitly here
in addition to schema-level RLS.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..auth import CurrentUser, get_current_user
from ..db import user_client

router = APIRouter(prefix="/parties", tags=["parties"])


class PartyCreateBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class PartyPatchBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class MemberAddBody(BaseModel):
    user_id: str
    character_id: Optional[str] = None
    role: Optional[str] = None


class MemberPatchBody(BaseModel):
    character_id: Optional[str] = None
    role: Optional[str] = None


def _emails_for(db, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    res = db.rpc("lookup_users_by_ids", {"p_ids": ids}).execute()
    return {row["id"]: row["email"] for row in (res.data or [])}


@router.get("", response_model=list[dict[str, Any]])
def list_parties(user: CurrentUser = Depends(get_current_user)):
    """Parties I own or am a member of (RLS already enforces this)."""
    db = user_client(user.token)
    parties = (
        db.table("parties")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    return parties


@router.post("", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED)
def create_party(
    body: PartyCreateBody,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    res = (
        db.table("parties")
        .insert({"owner_id": user.id, "name": body.name})
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Couldn't found the party.",
        )
    party = res.data[0]
    # Auto-add the owner as a member so they always show up in the roster.
    db.table("party_members").insert(
        {"party_id": party["id"], "user_id": user.id, "role": "leader"}
    ).execute()
    return party


@router.get("/{party_id}", response_model=dict[str, Any])
def get_party(
    party_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    party_res = db.table("parties").select("*").eq("id", party_id).execute()
    if not party_res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    party = party_res.data[0]
    members = (
        db.table("party_members")
        .select("*")
        .eq("party_id", party_id)
        .execute()
        .data
        or []
    )
    member_ids = [m["user_id"] for m in members]
    emails = _emails_for(db, member_ids)
    members_enriched = [
        {**m, "email": emails.get(m["user_id"])} for m in members
    ]
    return {**party, "members": members_enriched}


@router.patch("/{party_id}", response_model=dict[str, Any])
def patch_party(
    party_id: str,
    body: PartyPatchBody,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    updated = (
        db.table("parties")
        .update({"name": body.name})
        .eq("id", party_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    return updated.data[0]


@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_party(
    party_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    db.table("parties").delete().eq("id", party_id).execute()
    return None


def _are_friends(db, a: str, b: str) -> bool:
    res = (
        db.table("friendships")
        .select("status")
        .or_(
            f"and(requester_id.eq.{a},addressee_id.eq.{b}),"
            f"and(requester_id.eq.{b},addressee_id.eq.{a})"
        )
        .eq("status", "accepted")
        .execute()
    )
    return bool(res.data)


@router.post(
    "/{party_id}/members",
    response_model=dict[str, Any],
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    party_id: str,
    body: MemberAddBody,
    user: CurrentUser = Depends(get_current_user),
):
    db = user_client(user.token)
    party_res = (
        db.table("parties").select("owner_id").eq("id", party_id).execute()
    )
    if not party_res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    if party_res.data[0]["owner_id"] != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the leader may add to the party."
        )
    if body.user_id != user.id and not _are_friends(db, user.id, body.user_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You may only seat friends at your party.",
        )

    row = {
        "party_id": party_id,
        "user_id": body.user_id,
        "character_id": body.character_id,
        "role": body.role,
    }
    try:
        inserted = db.table("party_members").insert(row).execute()
    except Exception as exc:
        # PK collision = already in the party.
        if "duplicate" in str(exc).lower():
            raise HTTPException(
                status.HTTP_409_CONFLICT, "They're already at the party."
            ) from exc
        raise
    if not inserted.data:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Couldn't seat the member."
        )
    return inserted.data[0]


@router.patch("/{party_id}/members/{user_id}", response_model=dict[str, Any])
def patch_member(
    party_id: str,
    user_id: str,
    body: MemberPatchBody,
    user: CurrentUser = Depends(get_current_user),
):
    """Edit a party_member row.

    RLS already restricts who can update which row (the member themselves
    or the party owner). This route adds a field-level guard: only the
    party owner may change ``role`` — otherwise a member could self-promote
    to leader via a direct PATCH.
    """
    db = user_client(user.token)
    patch: dict[str, Any] = {}
    if body.character_id is not None:
        patch["character_id"] = body.character_id
    if body.role is not None:
        # Field-level authz: only the owner may change role.
        party = (
            db.table("parties")
            .select("owner_id")
            .eq("id", party_id)
            .execute()
        )
        if not party.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
        if party.data[0]["owner_id"] != user.id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Only the leader may reassign party roles.",
            )
        patch["role"] = body.role
    if not patch:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Nothing to update."
        )
    updated = (
        db.table("party_members")
        .update(patch)
        .eq("party_id", party_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return updated.data[0]


@router.delete(
    "/{party_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_member(
    party_id: str,
    user_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Remove a member from a party.

    RLS restricts who may delete which row (the member themselves or the
    party owner). When ``data`` is empty after delete, the row either
    didn't exist OR RLS filtered it — we surface a 404 so callers don't
    incorrectly assume the action succeeded.
    """
    db = user_client(user.token)
    res = (
        db.table("party_members")
        .delete()
        .eq("party_id", party_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return None
