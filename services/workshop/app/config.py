"""Workshop config — env-driven settings for Magic Mirror + Tavern Bard."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase (same project as ReRoll)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Magic Mirror — portrait
    fal_key: str = ""
    portrait_model: str = "fal-ai/flux-pro/v1.1-ultra"
    portrait_bucket: str = "portraits"

    # Tavern Bard
    suno_api_key: str = ""
    suno_base_url: str = "https://api.sunoapi.com/api/v1"
    song_bucket: str = "bard-songs"

    # Lyrics
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # Per-user rate limits (slowapi). The paid providers run real money on
    # every request; these caps mirror ReRoll's 20/day on /generate and add
    # a smaller cap on songs (Suno is the priciest) and an hourly cap on
    # friend invites (bounds the email-enumeration tradeoff documented in
    # supabase/migrations/0006_user_lookup.sql).
    daily_portrait_limit: int = 20
    daily_song_limit: int = 10
    hourly_friend_invite_limit: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
