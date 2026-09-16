"""Centralized Supabase client for the API process.

The API uses the **service_role** key so it can publish to Realtime channels and
(optionally) reach the Auth admin API server-side. Never expose this client or
its key to the frontend — the browser uses the anon/publishable key instead.
"""
from functools import lru_cache

from supabase import AsyncClient, create_async_client

from app.config import get_settings

_client: AsyncClient | None = None


async def get_supabase() -> AsyncClient:
    """Return a lazily-created, process-wide async Supabase client.

    Cached in a module global because `create_async_client` is a coroutine and
    therefore cannot go through `functools.lru_cache`.
    """
    global _client
    if _client is None:
        settings = get_settings()
        _client = await create_async_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    return _client
