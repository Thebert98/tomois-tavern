"""Supabase clients — service role (server-side privileged) and per-user (RLS-scoped)."""
from supabase import create_client, Client

from .config import settings


def service_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def user_client(token: str) -> Client:
    """Returns a Supabase client that operates as the authenticated user (RLS-scoped)."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(token)
    return client
