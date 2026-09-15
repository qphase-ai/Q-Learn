import pytest
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

import app.database as _db
from app.config import get_settings


@pytest.fixture(scope="session", autouse=True)
def use_null_pool():
    """Replace the shared connection pool with NullPool for the test session.

    The module-level engine holds pool connections tied to the event loop that
    created them. With function-scoped event loops (one per test), those
    connections become stale in the next test, causing:
        RuntimeError: Future attached to a different loop
    NullPool eliminates reuse — every request gets and closes its own connection.
    """
    settings = get_settings()
    test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
    test_session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    _db.engine = test_engine
    _db.AsyncSessionLocal = test_session_factory
    yield
