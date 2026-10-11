"""LangGraph checkpointer lifecycle (AsyncPostgresSaver on a psycopg pool).

psycopg needs a direct or session-mode connection, so it uses
CHECKPOINT_DATABASE_URL (or DATABASE_URL when that is not the :6543 transaction
pooler). If the saver cannot be opened the classroom degrades to a
non-resumable graph (no checkpointer) with a logged warning: the board and chat
are still persisted by the service, so teaching keeps working.
"""
from __future__ import annotations

import asyncio
from typing import Any

import structlog

from app.config import Settings, get_settings

logger = structlog.get_logger(__name__)

OPEN_TIMEOUT_SECONDS = 15
# Tables created by AsyncPostgresSaver.setup() (outside Alembic). Created in `public`,
# so RLS is enabled on them like every other table (no policies: service role only).
CHECKPOINT_TABLES = ("checkpoint_migrations", "checkpoints", "checkpoint_blobs", "checkpoint_writes")

_saver: Any | None = None
_pool: Any | None = None


def resolve_checkpoint_url(settings: Settings) -> str | None:
    """A libpq URL for psycopg, or None when no safe direct connection is known."""
    url = settings.checkpoint_database_url.strip()
    if not url:
        url = settings.database_url
        if ":6543" in url:
            return None  # transaction pooler: unusable for the checkpointer
    for prefix in ("postgresql+asyncpg://", "postgres+asyncpg://", "postgresql+psycopg://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix):]
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


async def open_checkpointer(settings: Settings | None = None) -> Any | None:
    """Open the pool, run `setup()` once and keep the saver. Never raises."""
    global _saver, _pool
    settings = settings or get_settings()
    url = resolve_checkpoint_url(settings)
    if url is None:
        logger.warning(
            "classroom_checkpointer_disabled",
            reason="DATABASE_URL is on the transaction pooler and CHECKPOINT_DATABASE_URL is unset",
        )
        return None
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg.rows import dict_row
        from psycopg_pool import AsyncConnectionPool

        pool = AsyncConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=4,
            open=False,
            kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
        )
        await pool.open(wait=True, timeout=OPEN_TIMEOUT_SECONDS)
        saver = AsyncPostgresSaver(pool)
        await asyncio.wait_for(saver.setup(), timeout=OPEN_TIMEOUT_SECONDS)
        await _enable_rls(pool)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001 — degrade, don't block startup
        logger.warning("classroom_checkpointer_unavailable", error=str(exc))
        try:
            if "pool" in locals():
                await pool.close()
        except Exception:  # noqa: BLE001
            pass
        return None
    _pool, _saver = pool, saver
    logger.info("classroom_checkpointer_ready")
    return saver


async def _enable_rls(pool: Any) -> None:
    """Best-effort: a failure here is logged, it does not disable the checkpointer."""
    try:
        async with pool.connection() as conn:
            for table in CHECKPOINT_TABLES:
                await conn.execute(f'ALTER TABLE IF EXISTS "public"."{table}" ENABLE ROW LEVEL SECURITY')
    except Exception as exc:  # noqa: BLE001
        logger.warning("classroom_checkpointer_rls_failed", error=str(exc))


async def close_checkpointer() -> None:
    global _saver, _pool
    pool, _pool, _saver = _pool, None, None
    if pool is not None:
        try:
            await pool.close()
        except Exception as exc:  # noqa: BLE001
            logger.warning("classroom_checkpointer_close_failed", error=str(exc))


def get_checkpointer() -> Any | None:
    return _saver
