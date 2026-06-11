"""Route tests for the Parties authorization fixes.

Covers:
- W6 — only the party owner may set ``role`` on a party_members row.
- W7 — ``remove_member`` returns 404 when no row is deleted (instead of
  the prior silent 204).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import FakeStore, _TEST_USER_ID


class TestPatchMember:
    def test_member_may_set_their_own_character_id(self, client: TestClient, fake_store: FakeStore) -> None:
        """Non-role patches are unrestricted by W6 — RLS is the floor and
        a member is allowed to swap which of their own characters they're
        playing in this party.

        The route now also verifies the target character belongs to the
        user being patched, so the fake has to return a matching row.
        """
        fake_store.set_table_response(
            "characters",
            "select",
            [{"user_id": _TEST_USER_ID}],
        )
        fake_store.set_table_response(
            "party_members",
            "update",
            [{"party_id": "P1", "user_id": _TEST_USER_ID, "character_id": "C2"}],
        )
        res = client.patch(
            f"/parties/P1/members/{_TEST_USER_ID}",
            json={"character_id": "C2"},
        )
        assert res.status_code == 200, res.text

    def test_member_cannot_set_someone_elses_character(self, client: TestClient, fake_store: FakeStore) -> None:
        """Audit caught: a member could assign another user's character
        to their own row. The character ownership check now rejects it
        with 403 before the update fires."""
        # Character belongs to a DIFFERENT user.
        fake_store.set_table_response(
            "characters",
            "select",
            [{"user_id": "some-other-user"}],
        )
        res = client.patch(
            f"/parties/P1/members/{_TEST_USER_ID}",
            json={"character_id": "C-belongs-elsewhere"},
        )
        assert res.status_code == 403
        assert "doesn't belong" in res.json()["detail"].lower()

    def test_non_owner_cannot_set_role(self, client: TestClient, fake_store: FakeStore) -> None:
        """W6 — a member calling PATCH .../members/self {role: "leader"}
        would have succeeded under pure-RLS (RLS lets a member update
        their own row). The API now refuses unless the caller is the
        party owner.
        """
        # The route resolves the party owner before applying the patch.
        # The fake says the owner is somebody ELSE, so the caller's
        # role-change attempt should be 403.
        fake_store.set_table_response(
            "parties", "select", [{"owner_id": "some-other-user"}]
        )
        res = client.patch(
            f"/parties/P1/members/{_TEST_USER_ID}",
            json={"role": "leader"},
        )
        assert res.status_code == 403
        assert "leader" in res.json()["detail"].lower()

    def test_owner_may_set_role(self, client: TestClient, fake_store: FakeStore) -> None:
        """The opposite case — when the caller is the owner, role
        assignment goes through."""
        fake_store.set_table_response(
            "parties", "select", [{"owner_id": _TEST_USER_ID}]
        )
        fake_store.set_table_response(
            "party_members",
            "update",
            [{"party_id": "P1", "user_id": "someone-else", "role": "wizard"}],
        )
        res = client.patch(
            "/parties/P1/members/someone-else",
            json={"role": "wizard"},
        )
        assert res.status_code == 200, res.text


class TestRemoveMember:
    def test_404_when_nothing_was_deleted(self, client: TestClient, fake_store: FakeStore) -> None:
        """W7 — used to return 204 whether or not anything was deleted;
        that masked both 'wrong id' and 'RLS rejected' cases. Now we
        surface a 404 so callers can tell."""
        fake_store.set_table_response("party_members", "delete", [])
        res = client.delete(f"/parties/P1/members/{_TEST_USER_ID}")
        assert res.status_code == 404

    def test_204_when_actually_deleted(self, client: TestClient, fake_store: FakeStore) -> None:
        fake_store.set_table_response(
            "party_members",
            "delete",
            [{"party_id": "P1", "user_id": _TEST_USER_ID}],
        )
        res = client.delete(f"/parties/P1/members/{_TEST_USER_ID}")
        assert res.status_code == 204
