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
    # Use service_client for both writes — the user_client writes against
    # parties + party_members trip the cached-plan recursion this file
    # routes around everywhere else. user.id is verified by the auth
    # dependency, so the explicit owner_id/user_id assignments are safe.
    sb = service_client()
    res = (
        sb.table("parties")
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
    sb.table("party_members").insert(
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

    # Enrich with the seated character's name, a short race/class/level
    # summary line, and active portrait. The Notice Board's redesigned
    # party view renders heroes — not their auth accounts.
    char_ids = [m["character_id"] for m in members if m.get("character_id")]
    char_meta_by_id: dict[str, dict[str, Any]] = {}
    portrait_by_char: dict[str, str] = {}
    if char_ids:
        try:
            chars = (
                sb.table("characters")
                .select("id,name,sheet")
                .in_("id", char_ids)
                .execute()
                .data
                or []
            )
            char_meta_by_id = {c["id"]: c for c in chars}
        except Exception:
            pass
        try:
            ports = (
                sb.table("portraits")
                .select("character_id,image_url")
                .in_("character_id", char_ids)
                .eq("is_current", True)
                .execute()
                .data
                or []
            )
            portrait_by_char = {
                p["character_id"]: p["image_url"] for p in ports if p.get("image_url")
            }
        except Exception:
            pass

    def _summary_for(sheet: dict[str, Any] | None) -> str | None:
        """Compose 'Race · Class · L#' from a ReRoll sheet, gracefully
        skipping fields the sheet hasn't filled out."""
        if not isinstance(sheet, dict):
            return None
        parts: list[str] = []
        for key in ("race", "char_class"):
            v = sheet.get(key)
            if isinstance(v, dict):
                v = v.get("value")
            if isinstance(v, str) and v.strip():
                parts.append(v.strip())
        lvl = sheet.get("level")
        if isinstance(lvl, dict):
            lvl = lvl.get("value")
        if isinstance(lvl, (int, str)) and str(lvl).strip() not in ("", "0"):
            parts.append(f"L{lvl}")
        return " · ".join(parts) or None

    members_enriched = []
    for m in members:
        cid = m.get("character_id") or ""
        char = char_meta_by_id.get(cid) or {}
        members_enriched.append(
            {
                **m,
                "email": emails.get(m["user_id"]),
                "character_name": char.get("name"),
                "character_summary": _summary_for(char.get("sheet")),
                "portrait_url": portrait_by_char.get(cid),
            }
        )

    return {**party, "members": members_enriched}


@router.patch("/{party_id}", response_model=dict[str, Any])
def patch_party(
    party_id: str,
    body: PartyPatchBody,
    user: CurrentUser = Depends(get_current_user),
):
    # Same recursion-cache trap that list_parties hit — user_client UPDATE
    # against parties trips 42P17 even though the policy is flat. Verify
    # ownership explicitly, then write via service_client.
    sb = service_client()
    party = sb.table("parties").select("owner_id").eq("id", party_id).execute().data
    if not party:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    if party[0]["owner_id"] != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the leader may rename the party.")
    updated = (
        sb.table("parties")
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
    # Same as patch_party — verify ownership, write via service_client.
    sb = service_client()
    party = sb.table("parties").select("owner_id").eq("id", party_id).execute().data
    if not party:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    if party[0]["owner_id"] != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the leader may disband the party.")
    sb.table("parties").delete().eq("id", party_id).execute()
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

    All reads + writes go through service_client. The user_client path
    was hitting the cached-recursive-plan trap on party_members that
    the rest of this file already routes around. Authz is enforced
    explicitly in app code: only the owner may set role; non-owners
    can only edit their own row's character_id; role can never be
    set on yourself (no self-promotion).
    """
    sb = service_client()
    patch: dict[str, Any] = {}
    if body.character_id is not None:
        patch["character_id"] = body.character_id
    role_requested = body.role is not None

    is_self = user_id == user.id

    # Role changes require the owner — always, including on yourself.
    # Editing someone else's row also requires the owner.
    needs_owner = role_requested or not is_self
    if needs_owner:
        party = sb.table("parties").select("owner_id").eq("id", party_id).execute().data
        if not party:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
        if party[0]["owner_id"] != user.id:
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

    updated = (
        sb.table("party_members")
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

    Always goes through service_client to dodge the party_members
    recursive-plan trap. Authz enforced in code:
      * member leaving themselves: allowed
      * owner kicking someone else: allowed
      * anyone else: 403

    Returns 404 when the delete affects zero rows.
    """
    sb = service_client()
    if user_id != user.id:
        # Owner-kicks-someone-else path.
        party = (
            sb.table("parties")
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

    res = (
        sb.table("party_members")
        .delete()
        .eq("party_id", party_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return None
