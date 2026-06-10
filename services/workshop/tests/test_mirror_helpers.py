"""Pure-function tests for the Mirror module.

Covers two of the audit's workshop fixes that don't need a Supabase or
fal.ai round-trip:

- W3 — ``_storage_path_from_url`` is robust to non-Supabase / malformed
  URLs (returns ``None`` cleanly, no exception).
- W4 — ``PortraitRequest`` rejects oversized + empty prompts.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.mirror import PortraitRequest, _storage_path_from_url


class TestStoragePathFromUrl:
    def test_extracts_path_inside_bucket(self) -> None:
        url = (
            "https://laystonzfxolwicjhuhf.supabase.co/storage/v1/object/"
            "public/portraits/user-abc/portrait-42.jpg"
        )
        assert _storage_path_from_url(url, bucket="portraits") == "user-abc/portrait-42.jpg"

    def test_returns_none_for_empty(self) -> None:
        assert _storage_path_from_url("", bucket="portraits") is None
        assert _storage_path_from_url(None, bucket="portraits") is None  # type: ignore[arg-type]

    def test_returns_none_for_non_supabase_url(self) -> None:
        # A URL that just happens to live somewhere else — we shouldn't
        # confidently parse it as if it were Supabase storage.
        assert _storage_path_from_url(
            "https://fal.ai/images/abc.png", bucket="portraits"
        ) is None

    def test_returns_none_when_bucket_doesnt_match(self) -> None:
        # Right host, right shape, wrong bucket — common cause of
        # the silent-skip bug the audit flagged.
        assert _storage_path_from_url(
            "https://x.supabase.co/storage/v1/object/public/avatars/u/f.jpg",
            bucket="portraits",
        ) is None

    def test_handles_malformed_url_without_raising(self) -> None:
        # urllib.parse tolerates almost everything; what matters here is
        # that the helper never throws on weird input — it logs + returns
        # None instead.
        assert _storage_path_from_url("not-a-url-at-all", bucket="portraits") is None
        assert _storage_path_from_url("https://", bucket="portraits") is None


class TestPortraitRequestValidation:
    """Pydantic field constraints from W4."""

    def test_minimal_request_is_accepted(self) -> None:
        req = PortraitRequest(character_id="abc", prompt="a portrait")
        assert req.aspect_ratio == "3:4"

    def test_empty_prompt_rejected(self) -> None:
        with pytest.raises(ValidationError):
            PortraitRequest(character_id="abc", prompt="")

    def test_oversized_prompt_rejected(self) -> None:
        with pytest.raises(ValidationError):
            PortraitRequest(character_id="abc", prompt="x" * 2001)

    def test_2000_char_prompt_is_at_the_limit(self) -> None:
        # Exactly 2000 should still pass — that's the inclusive cap.
        req = PortraitRequest(character_id="abc", prompt="x" * 2000)
        assert len(req.prompt) == 2000
