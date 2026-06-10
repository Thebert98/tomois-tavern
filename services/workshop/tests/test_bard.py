"""Route tests for the Bard.

Covers:
- W9 — ``POST /songs {scope: "lore"}`` returns 400 with the tavern-flavoured
  copy until lore CRUD ships.
- Pydantic validates the ``scope`` literal (basic Pydantic; included so
  the route's contract is documented and a future widening of the enum
  is intentional).
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_lore_scope_returns_400_with_tavern_copy(client: TestClient) -> None:
    res = client.post(
        "/songs",
        json={
            "scope": "lore",
            "source_id": None,
            "prompt": "a song of the burned harbor",
            "genre": "tavern folk",
        },
    )
    assert res.status_code == 400
    body = res.json()
    # Voice-glossary check: the message uses tavern language, not "not
    # implemented" or "503".
    assert "woven" in body["detail"].lower() or "land" in body["detail"].lower()


def test_unknown_scope_rejected_by_pydantic(client: TestClient) -> None:
    res = client.post(
        "/songs",
        json={"scope": "epic", "source_id": None, "prompt": "x", "genre": "tavern folk"},
    )
    # Pydantic's enum check fails before our route body runs.
    assert res.status_code == 422
