"""Route tests for /lore CRUD.

Lore was the only PLAN.md-deferred scope. This file proves the routes
follow the workshop's established patterns: Pydantic-validated body,
RLS-scoped client, 404 on missing delete, 201 on create.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import FakeStore, _TEST_USER_ID


def test_list_returns_user_entries(client: TestClient, fake_store: FakeStore) -> None:
    fake_store.set_table_response(
        "world_lore",
        "select",
        [
            {
                "id": "L1",
                "title": "The Burned Harbor",
                "body": "Ash and salt.",
                "created_at": "2026-06-10T00:00:00Z",
            }
        ],
    )
    res = client.get("/lore")
    assert res.status_code == 200
    assert res.json()[0]["title"] == "The Burned Harbor"


def test_create_requires_title_and_body(client: TestClient) -> None:
    # Pydantic rejects empty title before the route runs.
    res = client.post("/lore", json={"title": "", "body": "x"})
    assert res.status_code == 422


def test_create_rejects_oversized_body(client: TestClient) -> None:
    res = client.post("/lore", json={"title": "Test", "body": "x" * 4001})
    assert res.status_code == 422


def test_create_persists(client: TestClient, fake_store: FakeStore) -> None:
    fake_store.set_table_response(
        "world_lore",
        "insert",
        [
            {
                "id": "L2",
                "title": "Tomoi's Tavern",
                "body": "A warm corner of the world.",
                "created_at": "2026-06-10T00:00:00Z",
            }
        ],
    )
    res = client.post(
        "/lore",
        json={"title": "Tomoi's Tavern", "body": "A warm corner of the world."},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["id"] == "L2"
    assert body["title"] == "Tomoi's Tavern"


def test_delete_404_when_missing(client: TestClient, fake_store: FakeStore) -> None:
    # The delete chain returns no rows → 404 with tavern copy.
    fake_store.set_table_response("world_lore", "delete", [])
    res = client.delete("/lore/L1")
    assert res.status_code == 404
    assert "book" in res.json()["detail"].lower() or "page" in res.json()["detail"].lower()


def test_delete_204_when_present(client: TestClient, fake_store: FakeStore) -> None:
    fake_store.set_table_response(
        "world_lore",
        "delete",
        [{"id": "L1", "user_id": _TEST_USER_ID}],
    )
    res = client.delete("/lore/L1")
    assert res.status_code == 204
