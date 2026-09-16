from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()

# Supabase's transaction pooler (pgbouncer, port 6543) multiplexes connections
# per-transaction, so server-side pooling and asyncpg's prepared-statement cache
# must be disabled. Detected by port so local Docker (5432) keeps normal pooling.
if ":6543" in settings.database_url:
    engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        poolclass=NullPool,
        connect_args={"statement_cache_size": 0},
    )
else:
    engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
