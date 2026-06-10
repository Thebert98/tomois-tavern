"""Pytest scaffolding for the workshop.

Two affordances live here:

1. A minimal Supabase / PostgREST chain mock. The supabase-py client is
   a method-chained builder pattern (``db.table("x").select("*").eq("y", z).execute()``);
   the mock records every call and returns a configurable result on ``.execute()``.
2. A FastAPI TestClient fixture with the auth dependency overridden so
   tests don't need a real JWT, and with ``app.db.user_client`` swapped
   for the supabase mock so no network call ever leaves the process.

These are deliberately small — just enough to exercise the route logic
this audit added (role-set guard, lore 400, list_portraits reaper) — not
a full DB simulation. Anything more would belong in a separate
integration-test tier against a real Supabase project.
"""
from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app import db as db_module
from app.api import bard as bard_module
from app.api import friends as friends_module
from app.api import mirror as mirror_module
from app.api import parties as parties_module
from app.auth import CurrentUser, get_current_user
from app.main import app

_TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
_TEST_TOKEN = "test-token"


class FakeQuery:
    """One PostgREST query chain. ``execute()`` returns the configured
    result; ``data`` is what comes back. Every chained call records its
    arguments so tests can assert on intent (e.g. "the patch_member route
    looked up the parties row before updating party_members").
    """

    def __init__(self, table: str, op: str, store: "FakeStore"):
        self.table = table
        self.op = op
        self.store = store
        self.payload: Any = None
        self.filters: list[tuple[str, str, Any]] = []
        self.calls: list[str] = []

    # --- builder methods all return self -----------------------------------
    def select(self, *_args: Any, **_kw: Any) -> "FakeQuery":
        self.calls.append("select")
        return self

    def insert(self, payload: Any) -> "FakeQuery":
        self.calls.append("insert")
        self.payload = payload
        self.op = "insert"
        return self

    def update(self, payload: Any) -> "FakeQuery":
        self.calls.append("update")
        self.payload = payload
        self.op = "update"
        return self

    def delete(self) -> "FakeQuery":
        self.calls.append("delete")
        self.op = "delete"
        return self

    def eq(self, col: str, val: Any) -> "FakeQuery":
        self.filters.append(("eq", col, val))
        return self

    def lt(self, col: str, val: Any) -> "FakeQuery":
        self.filters.append(("lt", col, val))
        return self

    def order(self, *_args: Any, **_kw: Any) -> "FakeQuery":
        return self

    def limit(self, _n: int) -> "FakeQuery":
        return self

    def or_(self, _expr: str) -> "FakeQuery":
        return self

    def execute(self) -> Any:
        result = self.store.result_for(self.table, self.op, self.filters)
        self.store.calls.append(
            {
                "table": self.table,
                "op": self.op,
                "filters": self.filters,
                "payload": self.payload,
            }
        )
        return result


class FakeRpc:
    def __init__(self, name: str, args: dict[str, Any], store: "FakeStore"):
        self.name = name
        self.args = args
        self.store = store

    def execute(self) -> Any:
        self.store.calls.append({"rpc": self.name, "args": self.args})
        return self.store.rpc_result_for(self.name)


class FakeStore:
    """Holds the configured responses + the recorded calls."""

    def __init__(self) -> None:
        # key: (table, op) or table → SimpleNamespace(data=...)
        self.responses: dict[Any, Any] = {}
        self.rpc_responses: dict[str, Any] = {}
        self.calls: list[dict[str, Any]] = []

    def set_table_response(self, table: str, op: str, data: Any) -> None:
        self.responses[(table, op)] = MagicMock(data=data)

    def set_rpc_response(self, name: str, data: Any) -> None:
        self.rpc_responses[name] = MagicMock(data=data)

    def result_for(self, table: str, op: str, _filters: list[tuple[str, str, Any]]) -> Any:
        return self.responses.get((table, op), MagicMock(data=[]))

    def rpc_result_for(self, name: str) -> Any:
        return self.rpc_responses.get(name, MagicMock(data=None))


class FakeSupabase:
    """The thing ``user_client`` would normally return."""

    def __init__(self, store: FakeStore):
        self.store = store

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(name, op="select", store=self.store)

    def rpc(self, name: str, args: dict[str, Any]) -> FakeRpc:
        return FakeRpc(name, args, self.store)


@pytest.fixture
def fake_store() -> FakeStore:
    """A fresh response store + call recorder per test."""
    return FakeStore()


@pytest.fixture
def client(fake_store: FakeStore, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """FastAPI TestClient with auth + db dependencies wired to the fakes."""
    fake_db = FakeSupabase(fake_store)
    # ``from ..db import user_client`` in each route module binds the
    # symbol at import time, so we have to swap it at each call site —
    # patching `db_module.user_client` alone has no effect on routes.
    fake_user_client = lambda _token: fake_db
    fake_service_client = lambda: fake_db
    monkeypatch.setattr(db_module, "user_client", fake_user_client)
    monkeypatch.setattr(db_module, "service_client", fake_service_client)
    for mod in (bard_module, friends_module, mirror_module, parties_module):
        if hasattr(mod, "user_client"):
            monkeypatch.setattr(mod, "user_client", fake_user_client)
        if hasattr(mod, "service_client"):
            monkeypatch.setattr(mod, "service_client", fake_service_client)

    def _override_current_user() -> CurrentUser:
        return CurrentUser(id=_TEST_USER_ID, token=_TEST_TOKEN)

    app.dependency_overrides[get_current_user] = _override_current_user
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def test_user_id() -> str:
    return _TEST_USER_ID
