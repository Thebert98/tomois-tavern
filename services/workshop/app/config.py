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

    # Magic Mirror
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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
