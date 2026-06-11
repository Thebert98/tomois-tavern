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
from ..db import service_client, user_client

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
    """Resolve user ids to emails.

    We used to call the ``lookup_users_by_ids`` PostgreSQL function via
    PostgREST RPC, but the project's PGRST schema cache stayed stuck on
    PGRST202 for that function after a series of schema changes — making
    the lookup permanently broken until the next PostgREST restart. The
    fallback was an empty map, which meant friends + party members
    rendered as uuids in the UI.

    The robust fix is to use the gotrue admin endpoint directly. The
    service-role key authorizes ``GET /auth/v1/admin/users/{id}`` for
    any user, so we just iterate the requested ids. For the small N
    we ever look up at once (party members, accepted friends + pending
    invites), the round-trip cost is negligible.
    """
    if not ids:
        return {}
    sb = service_client()
    out: dict[str, str] = {}
    for uid in ids:
        try:
            res = sb.auth.admin.get_user_by_id(uid)
            email = getattr(getattr(res, "user", None), "email", None)
            if email:
                out[uid] = email
        except Exception:
            # Unknown id / network blip / etc. — fall through; the UI
            # gracefully shows the uuid for any missing entry.
            continue
    return out


@router.get("", response_model=list[dict[str, Any]])
def list_parties(user: CurrentUser = Depends(get_current_user)):
    """Parties the user owns OR is a member of.

    The RLS layer on ``parties`` only matches owner_id — the recursive
    "or is a member" half of the original policy was removed (it
    triggered Postgres recursion against the party_members policy).
    We restore "see your parties as a member" here in app code: read
    the user's party_members rows, then fetch those parties through
    the service client (RLS bypassed for the targeted read, scoped to
    just the ids we already know the user belongs to).
    """
    # Use service_client + explicit ``user.id`` filters throughout. We
    # already verified the caller's identity via ``get_current_user``,
    # so a service-role query that's explicitly scoped to their ids is
    # equivalent to an RLS-scoped user_client query — and it sidesteps
    # the stubborn 42P17 recursion the migration history can't seem to
    # purge from cached query plans.
    sb = service_client()

    owned = (
        sb.table("parties")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    membership = (
        sb.table("party_members")
        .select("party_id")
        .eq("user_id", user.id)
        .execute()
        .data
        or []
    )
    owned_ids = {p["id"] for p in owned}
    member_party_ids = [m["party_id"] for m in membership if m["party_id"] not in owned_ids]

    member_parties: list[dict[str, Any]] = []
    if member_party_ids:
        member_parties = (
            sb.table("parties")
            .select("*")
            .in_("id", member_party_ids)
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )

    return owned + member_parties


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
    """Return a party + its members.

    Visibility check: caller must be the owner OR have a party_members
    row in this party. RLS on the user_client guarantees the second
    half — if the user has no party_members row here, the membership
    SELECT returns empty.

    Member listing: the owner-sees-everyone case is done with the
    service client (RLS bypassed) since the user has already proven
    they're either the owner or a member. Non-owners get back only
    their own member row, mirroring the old RLS shape.
    """
    sb = service_client()

    party = (
        sb.table("parties").select("*").eq("id", party_id).execute().data or []
    )
    if not party:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    party = party[0]

    is_owner = party["owner_id"] == user.id

    # Confirm membership for non-owners — explicit filter via service_client.
    if not is_owner:
        own_membership = (
            sb.table("party_members")
            .select("user_id")
            .eq("party_id", party_id)
            .eq("user_id", user.id)
            .execute()
            .data
            or []
        )
        if not own_membership:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")

    if is_owner:
        members = (
            sb.table("party_members")
            .select("*")
            .eq("party_id", party_id)
            .execute()
            .data
            or []
        )
    else:
        members = (
            sb.table("party_members")
            .select("*")
            .eq("party_id", party_id)
            .eq("user_id", user.id)
            .execute()
            .data
            or []
        )

    member_ids = [m["user_id"] for m in members]
    emails = _emails_for(sb, member_ids)
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
    """Seat someone at the party. Only the owner can do this.

    After flattening the party_members RLS so each user only INSERTs
    their own row, an owner adding a friend would no longer match RLS.
    The owner is verified by the explicit ``party_res`` check above, so
    we can safely use ``service_client`` for the actual write.
    """
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
    sb = service_client()
    try:
        inserted = sb.table("party_members").insert(row).execute()
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

    Two authz cases:
      * member editing their own row (character_id) → user_client + RLS
      * owner editing someone else's row (role or character_id) →
        verify ownership via the parties table, then service_client
        for the write (post-flat-RLS, an owner is not the row's user_id
        and RLS wouldn't permit the write).

    A role change always requires the owner — even on the caller's own
    row — to prevent self-promotion.
    """
    db = user_client(user.token)
    patch: dict[str, Any] = {}
    if body.character_id is not None:
        patch["character_id"] = body.character_id
    role_requested = body.role is not None

    is_self = user_id == user.id

    # If role is being touched, verify owner. Same if caller isn't the
    # row's user (only the owner can edit someone else's row at all).
    needs_owner = role_requested or not is_self
    if needs_owner:
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
                "Only the leader may make that change.",
            )
        if role_requested:
            patch["role"] = body.role

    if not patch:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Nothing to update."
        )

    writer = service_client() if needs_owner else db
    updated = (
        writer.table("party_members")
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

    Two cases:
      * member leaving (user_id == auth.uid()) — user_client + RLS works
      * owner kicking someone else — verify ownership, then service_client

    Returns 404 if the delete affects zero rows so callers can tell
    whether the action took effect (same pattern as every other
    endpoint that returns 204 on success).
    """
    db = user_client(user.token)
    if user_id != user.id:
        # Owner-kicks-someone-else path.
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
                status.HTTP_403_FORBIDDEN, "Only the leader may remove that member."
            )
        writer = service_client()
    else:
        # User leaving on their own.
        writer = db

    res = (
        writer.table("party_members")
        .delete()
        .eq("party_id", party_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return None
