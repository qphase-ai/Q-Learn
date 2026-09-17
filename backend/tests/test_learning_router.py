"""Tests for the learning router.

Hermetic — no live database. Uses FastAPI dependency_overrides and
monkeypatching so no PostgreSQL is needed.

Endpoints covered:
  GET  /api/v1/courses                    → list[CourseSummary]
  GET  /api/v1/courses/{course_id}        → CourseDetail  (404 on unknown)
  GET  /api/v1/lessons/{lesson_id}        → LessonDetail
  GET  /api/v1/progress                   → list[ProgressItem]
  PUT  /api/v1/lessons/{lesson_id}/progress → ProgressItem
"""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

from app.database import get_db
from app.dependencies import get_current_user
from app.exceptions import NotFoundError
from app.main import app
from app.services import learning_service as svc_module


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_user(user_id: uuid.UUID | None = None):
    user = MagicMock()
    user.id = user_id or uuid.uuid4()
    return user


def _fake_course(course_id: uuid.UUID | None = None) -> MagicMock:
    """ORM-like object with CourseSummary attributes."""
    obj = MagicMock()
    obj.id = course_id or uuid.uuid4()
    obj.title = "Intro to Quantum"
    obj.description = "Learn the basics"
    obj.difficulty = "beginner"
    obj.modules = []
    return obj


def _fake_lesson(lesson_id: uuid.UUID | None = None) -> MagicMock:
    """ORM-like object with LessonDetail attributes."""
    obj = MagicMock()
    obj.id = lesson_id or uuid.uuid4()
    obj.module_id = uuid.uuid4()
    obj.title = "Qubits 101"
    obj.content = "Some content"
    obj.lesson_type = "theory"
    obj.is_pro = False
    obj.concepts = []
    return obj


def _fake_progress(lesson_id: uuid.UUID | None = None) -> MagicMock:
    """ORM-like object with ProgressItem attributes."""
    obj = MagicMock()
    obj.lesson_id = lesson_id or uuid.uuid4()
    obj.status = "in_progress"
    obj.completion_pct = 50.0
    return obj


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def clean_overrides():
    """Ensure dependency_overrides are cleared after every test."""
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# GET /api/v1/courses
# ---------------------------------------------------------------------------

async def test_list_courses_success(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Authed GET /courses → 200, success=True, returns the seeded course list."""
    course = _fake_course()

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        svc_module.LearningService,
        "list_courses",
        AsyncMock(return_value=[course]),
    )

    response = await client.get("/api/v1/courses")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["title"] == course.title
    assert data[0]["difficulty"] == course.difficulty


async def test_list_courses_requires_auth(
    client: AsyncClient,
    clean_overrides,
):
    """No auth → 401 or 403."""
    response = await client.get("/api/v1/courses")
    assert response.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /api/v1/courses/{course_id}
# ---------------------------------------------------------------------------

async def test_get_course_detail_success(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Authed GET /courses/{id} for existing course → 200, CourseDetail."""
    course_id = uuid.uuid4()
    course = _fake_course(course_id)

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        svc_module.LearningService,
        "get_course_detail",
        AsyncMock(return_value=course),
    )

    response = await client.get(f"/api/v1/courses/{course_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["id"] == str(course_id)
    assert body["data"]["title"] == course.title


async def test_get_course_detail_not_found(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Service raises NotFoundError → 404, error.code == 'NOT_FOUND'."""
    unknown_id = uuid.uuid4()

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        svc_module.LearningService,
        "get_course_detail",
        AsyncMock(side_effect=NotFoundError(f"Course {unknown_id} not found")),
    )

    response = await client.get(f"/api/v1/courses/{unknown_id}")

    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


# ---------------------------------------------------------------------------
# GET /api/v1/lessons/{lesson_id}
# ---------------------------------------------------------------------------

async def test_get_lesson_success(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Authed GET /lessons/{id} → 200, LessonDetail."""
    lesson_id = uuid.uuid4()
    lesson = _fake_lesson(lesson_id)

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        svc_module.LearningService,
        "get_lesson",
        AsyncMock(return_value=lesson),
    )

    response = await client.get(f"/api/v1/lessons/{lesson_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["id"] == str(lesson_id)
    assert body["data"]["title"] == lesson.title


# ---------------------------------------------------------------------------
# GET /api/v1/progress
# ---------------------------------------------------------------------------

async def test_get_progress_success(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Authed GET /progress → 200, list[ProgressItem]."""
    lesson_id = uuid.uuid4()
    progress = _fake_progress(lesson_id)

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        svc_module.LearningService,
        "get_progress",
        AsyncMock(return_value=[progress]),
    )

    response = await client.get("/api/v1/progress")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["lesson_id"] == str(lesson_id)
    assert data[0]["status"] == "in_progress"


# ---------------------------------------------------------------------------
# PUT /api/v1/lessons/{lesson_id}/progress
# ---------------------------------------------------------------------------

async def test_upsert_progress_success(
    client: AsyncClient,
    clean_overrides,
    monkeypatch,
):
    """Authed PUT /lessons/{id}/progress → 200, ProgressItem."""
    lesson_id = uuid.uuid4()
    progress = _fake_progress(lesson_id)
    progress.status = "completed"
    progress.completion_pct = 100.0

    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_current_user] = lambda: _fake_user()

    monkeypatch.setattr(
        svc_module.LearningService,
        "upsert_progress",
        AsyncMock(return_value=progress),
    )

    response = await client.put(
        f"/api/v1/lessons/{lesson_id}/progress",
        json={"status": "completed", "completion_pct": 100.0},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["lesson_id"] == str(lesson_id)
    assert body["data"]["status"] == "completed"
    assert body["data"]["completion_pct"] == 100.0


async def test_upsert_progress_requires_auth(
    client: AsyncClient,
    clean_overrides,
):
    """No auth → 401 or 403."""
    lesson_id = uuid.uuid4()
    response = await client.put(
        f"/api/v1/lessons/{lesson_id}/progress",
        json={"status": "in_progress", "completion_pct": 0.0},
    )
    assert response.status_code in (401, 403)
