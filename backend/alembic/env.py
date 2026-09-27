import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from alembic import context
from app.config import get_settings
from app.models import Base  # imports all models so metadata is populated

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = get_settings().database_url
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    url = get_settings().database_url
    # Supabase's transaction pooler (pgbouncer, port 6543) multiplexes
    # connections per-transaction, so server-side pooling and asyncpg's
    # prepared-statement cache must be disabled — otherwise `alembic upgrade`
    # on boot fails intermittently with 'prepared statement already exists'.
    # Mirrors app/database.py; keyed on the port so local Docker (5432) is
    # unaffected.
    engine_kwargs: dict = {}
    if ":6543" in url:
        engine_kwargs = {"poolclass": NullPool, "connect_args": {"statement_cache_size": 0}}
    engine = create_async_engine(url, **engine_kwargs)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
