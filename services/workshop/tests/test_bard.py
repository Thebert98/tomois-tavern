"""Route tests for the Bard.

Covers:
- Lore scope WITHOUT a source_id returns 400 with tavern-flavoured copy
  (the LORE CRUD shipped, so the API no longer rejects scope=lore
  outright — but it does require pointing the bard at a specific lore
  entry to ground the song against).
- Pydantic validates the ``scope`` literal (basic Pydantic; included so
  the route's contract is documented and a future widening of the enum
  is intentional).
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_lore_scope_without_source_returns_400(client: TestClient) -> None:
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
    # Voice-glossary check: the message uses tavern language, not
    # "Bad Request" or a stack trace, and it tells the user WHAT to do.
    assert "lore" in body["detail"].lower()
    assert "bard" in body["detail"].lower() or "point" in body["detail"].lower()


def test_unknown_scope_rejected_by_pydantic(client: TestClient) -> None:
    res = client.post(
        "/songs",
        json={"scope": "epic", "source_id": None, "prompt": "x", "genre": "tavern folk"},
    )
    # Pydantic's enum check fails before our route body runs.
    assert res.status_code == 422
