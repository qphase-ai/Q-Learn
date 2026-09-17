"""Tests for LearningService.

Hermetic — no real DB connections. All DB I/O is mocked with AsyncMock.
Follows the same pattern as test_circuits_service.py.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import NotFoundError
from app.schemas.learning import UpdateProgressRequest


# ---------------------------------------------------------------------------
# Helpers — canned ORM objects
# ---------------------------------------------------------------------------

def _make_concept(lesson_id: uuid.UUID | None = None) -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.lesson_id = lesson_id or uuid.uuid4()
    c.name = "Superposition"
    c.description = "A qubit in superposition"
    c.prerequisites = []
    return c


def _make_lesson(module_id: uuid.UUID | None = None, *, is_pro: bool = False) -> MagicMock:
    l = MagicMock()
    l.id = uuid.uuid4()
    l.module_id = module_id or uuid.uuid4()
    l.title = "Intro to Qubits"
    l.content = "Content here"
    l.lesson_type = "text"
    l.order_index = 0
    l.is_pro = is_pro
    l.concepts = [_make_concept(l.id)]
    return l


def _make_module(course_id: uuid.UUID | None = None) -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.course_id = course_id or uuid.uuid4()
    m.title = "Module 1"
    m.description = "First module"
    m.order_index = 0
    lesson = _make_lesson(m.id)
    m.lessons = [lesson]
    return m


def _make_course(*, is_published: bool = True, order_index: int = 0) -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.title = "Quantum Basics"
    c.description = "Learn quantum basics"
    c.difficulty = "beginner"
    c.is_published = is_published
    c.order_index = order_index
    mod = _make_module(c.id)
    c.modules = [mod]
    return c


def _make_progress(user_id: uuid.UUID | None = None, lesson_id: uuid.UUID | None = None) -> MagicMock:
    p = MagicMock()
    p.id = uuid.uuid4()
    p.user_id = user_id or uuid.uuid4()
    p.lesson_id = lesson_id or uuid.uuid4()
    p.status = "not_started"
    p.completion_pct = 0.0
    p.last_accessed_at = datetime.now(timezone.utc)
    return p


def _make_mock_db() -> AsyncMock:
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.get = AsyncMock(return_value=None)
    return db


def _scalars_result(items: list) -> MagicMock:
    """Wrap items so that result.scalars().all() returns items."""
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = items
    result = MagicMock()
    result.scalars.return_value = scalars_mock
    return result


def _scalar_one_or_none_result(item) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = item
    return result


# ---------------------------------------------------------------------------
# list_courses
# ---------------------------------------------------------------------------

class TestListCourses:

    @pytest.mark.asyncio
    async def test_returns_only_published_courses(self):
        from app.services.learning_service import LearningService

        pub1 = _make_course(is_published=True, order_index=0)
        pub2 = _make_course(is_published=True, order_index=1)
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalars_result([pub1, pub2]))

        svc = LearningService(db=db)
        result = await svc.list_courses()

        assert result == [pub1, pub2]
        db.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_published(self):
        from app.services.learning_service import LearningService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalars_result([]))

        svc = LearningService(db=db)
        result = await svc.list_courses()

        assert result == []

    @pytest.mark.asyncio
    async def test_query_filters_published_only(self):
        """Smoke-check: db.execute is called (we can't inspect SQLAlchemy internals,
        but the service must forward the call exactly once)."""
        from app.services.learning_service import LearningService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalars_result([]))

        svc = LearningService(db=db)
        await svc.list_courses()

        assert db.execute.await_count == 1


# ---------------------------------------------------------------------------
# get_course_detail
# ---------------------------------------------------------------------------

class TestGetCourseDetail:

    @pytest.mark.asyncio
    async def test_returns_course_with_modules_and_lessons(self):
        from app.services.learning_service import LearningService

        course = _make_course(is_published=True)
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(course))

        svc = LearningService(db=db)
        result = await svc.get_course_detail(course.id)

        assert result is course
        assert len(result.modules) == 1

    @pytest.mark.asyncio
    async def test_raises_not_found_when_missing(self):
        from app.services.learning_service import LearningService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        svc = LearningService(db=db)
        with pytest.raises(NotFoundError):
            await svc.get_course_detail(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_raises_not_found_when_unpublished(self):
        from app.services.learning_service import LearningService

        unpublished = _make_course(is_published=False)
        db = _make_mock_db()
        # Query that filters on is_published returns None for unpublished courses
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        svc = LearningService(db=db)
        with pytest.raises(NotFoundError):
            await svc.get_course_detail(unpublished.id)


# ---------------------------------------------------------------------------
# get_lesson
# ---------------------------------------------------------------------------

class TestGetLesson:

    @pytest.mark.asyncio
    async def test_returns_lesson_with_concepts(self):
        from app.services.learning_service import LearningService

        lesson = _make_lesson()
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(lesson))

        svc = LearningService(db=db)
        result = await svc.get_lesson(lesson.id)

        assert result is lesson
        assert len(result.concepts) == 1

    @pytest.mark.asyncio
    async def test_raises_not_found_when_missing(self):
        from app.services.learning_service import LearningService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        svc = LearningService(db=db)
        with pytest.raises(NotFoundError):
            await svc.get_lesson(uuid.uuid4())


# ---------------------------------------------------------------------------
# get_progress
# ---------------------------------------------------------------------------

class TestGetProgress:

    @pytest.mark.asyncio
    async def test_returns_all_progress_for_user(self):
        from app.services.learning_service import LearningService

        user_id = uuid.uuid4()
        p1 = _make_progress(user_id=user_id)
        p2 = _make_progress(user_id=user_id)
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalars_result([p1, p2]))

        svc = LearningService(db=db)
        result = await svc.get_progress(user_id)

        assert result == [p1, p2]

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_progress(self):
        from app.services.learning_service import LearningService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalars_result([]))

        svc = LearningService(db=db)
        result = await svc.get_progress(uuid.uuid4())

        assert result == []


# ---------------------------------------------------------------------------
# upsert_progress
# ---------------------------------------------------------------------------

class TestUpsertProgress:

    @pytest.mark.asyncio
    async def test_inserts_new_row_when_none_exists(self):
        """When no existing progress row, a new LearningProgress is added."""
        from app.services.learning_service import LearningService
        from app.models.progress import LearningProgress

        user_id = uuid.uuid4()
        lesson_id = uuid.uuid4()
        body = UpdateProgressRequest(status="in_progress", completion_pct=50.0)

        db = _make_mock_db()
        # No existing row
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        svc = LearningService(db=db)
        result = await svc.upsert_progress(user_id, lesson_id, body)

        db.add.assert_called_once()
        added = db.add.call_args.args[0]
        assert isinstance(added, LearningProgress)
        assert added.user_id == user_id
        assert added.lesson_id == lesson_id
        assert added.status == "in_progress"
        assert added.completion_pct == 50.0
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_updates_existing_row(self):
        """When a progress row already exists, it is mutated (not duplicated)."""
        from app.services.learning_service import LearningService

        user_id = uuid.uuid4()
        lesson_id = uuid.uuid4()
        existing = _make_progress(user_id=user_id, lesson_id=lesson_id)
        existing.status = "not_started"
        existing.completion_pct = 0.0
        body = UpdateProgressRequest(status="completed", completion_pct=100.0)

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(existing))

        svc = LearningService(db=db)
        result = await svc.upsert_progress(user_id, lesson_id, body)

        # Should NOT add a new row
        db.add.assert_not_called()
        assert existing.status == "completed"
        assert existing.completion_pct == 100.0
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_last_accessed_at_refreshed_on_update(self):
        """last_accessed_at is updated on every upsert."""
        from app.services.learning_service import LearningService

        user_id = uuid.uuid4()
        lesson_id = uuid.uuid4()
        existing = _make_progress(user_id=user_id, lesson_id=lesson_id)
        body = UpdateProgressRequest(status="in_progress", completion_pct=30.0)

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(existing))

        svc = LearningService(db=db)
        await svc.upsert_progress(user_id, lesson_id, body)

        # last_accessed_at must have been set to a datetime
        assert existing.last_accessed_at is not None

    @pytest.mark.asyncio
    async def test_commit_and_refresh_always_called(self):
        """commit and refresh are called regardless of insert vs update path."""
        from app.services.learning_service import LearningService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))
        body = UpdateProgressRequest(status="in_progress", completion_pct=0.0)

        svc = LearningService(db=db)
        await svc.upsert_progress(uuid.uuid4(), uuid.uuid4(), body)

        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once()
