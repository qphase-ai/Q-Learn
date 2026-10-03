"""Learning service — business logic for courses, lessons, and student progress.

Design choice: all read methods return ORM objects (Course, Lesson,
LearningProgress). The router serialises them to Pydantic schemas via
``model_validate`` / ``from_attributes=True``. This mirrors the pattern in
circuits_service and keeps the service free of schema imports.

The only exception is upsert_progress, which also returns an ORM object so
the router can call model_validate(LearningProgress) -> ProgressItem.
"""
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import structlog
from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundError
from app.models.content_ref import ContentKind
from app.models.learning import Concept, Course, Lesson, Module
from app.models.progress import LearningProgress
from app.schemas.learning import UpdateProgressRequest
from app.services.content_ref_service import ContentRefService

logger = structlog.get_logger(__name__)

SNIPPET_RADIUS = 60


@dataclass(frozen=True)
class LessonSearchHit:
    """A lesson matching a search query, with its module and course context."""

    lesson_id: uuid.UUID
    lesson_title: str
    lesson_type: str
    is_pro: bool
    module_id: uuid.UUID
    module_title: str
    course_id: uuid.UUID
    course_title: str
    snippet: str | None


def _like_pattern(query: str) -> str:
    """Case-insensitive substring pattern with LIKE wildcards escaped."""
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _snippet(content: str | None, query: str) -> str | None:
    """Excerpt of ``content`` around the first match of ``query``, if any."""
    if not content:
        return None
    pos = content.lower().find(query.lower())
    if pos < 0:
        return None
    start = max(0, pos - SNIPPET_RADIUS)
    end = min(len(content), pos + len(query) + SNIPPET_RADIUS)
    text = " ".join(content[start:end].split())
    return f"{'…' if start > 0 else ''}{text}{'…' if end < len(content) else ''}"


class LearningService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Courses
    # ------------------------------------------------------------------

    async def list_courses(self) -> list[Course]:
        """Return all published courses ordered by order_index."""
        result = await self.db.execute(
            select(Course)
            .where(Course.is_published == True)  # noqa: E712
            .order_by(Course.order_index)
        )
        return list(result.scalars().all())

    async def get_course_detail(self, course_id: uuid.UUID) -> Course:
        """Return a single published course with eager-loaded modules and lessons.

        Raises NotFoundError if the course is absent or not published.
        """
        result = await self.db.execute(
            select(Course)
            .where(Course.id == course_id, Course.is_published == True)  # noqa: E712
            .options(
                selectinload(Course.modules).selectinload(Module.lessons)
            )
        )
        course = result.scalar_one_or_none()
        if course is None:
            raise NotFoundError(f"Course {course_id} not found")
        return course

    # ------------------------------------------------------------------
    # Lessons
    # ------------------------------------------------------------------

    async def get_lesson(self, lesson_id: uuid.UUID) -> Lesson:
        """Return a single lesson with eager-loaded concepts.

        Raises NotFoundError if absent.
        """
        result = await self.db.execute(
            select(Lesson)
            .where(Lesson.id == lesson_id)
            .options(selectinload(Lesson.concepts))
        )
        lesson = result.scalar_one_or_none()
        if lesson is None:
            raise NotFoundError(f"Lesson {lesson_id} not found")
        return lesson

    async def search_lessons(self, query: str, limit: int = 10) -> list[LessonSearchHit]:
        """Return lessons of published courses whose title, content, or a
        concept name contains ``query`` (case-insensitive).

        Title matches rank first; ties keep curriculum order.
        """
        query = query.strip()
        if not query:
            return []
        pattern = _like_pattern(query)
        title_match = Lesson.title.ilike(pattern, escape="\\")
        concept_match = Lesson.id.in_(
            select(Concept.lesson_id).where(Concept.name.ilike(pattern, escape="\\"))
        )
        result = await self.db.execute(
            select(Lesson, Module, Course)
            .join(Module, Lesson.module_id == Module.id)
            .join(Course, Module.course_id == Course.id)
            .where(
                Course.is_published == True,  # noqa: E712
                or_(
                    title_match,
                    Lesson.content.ilike(pattern, escape="\\"),
                    concept_match,
                ),
            )
            .order_by(
                case((title_match, 0), else_=1),
                Course.order_index,
                Module.order_index,
                Lesson.order_index,
            )
            .limit(limit)
        )
        return [
            LessonSearchHit(
                lesson_id=lesson.id,
                lesson_title=lesson.title,
                lesson_type=lesson.lesson_type,
                is_pro=lesson.is_pro,
                module_id=module.id,
                module_title=module.title,
                course_id=course.id,
                course_title=course.title,
                snippet=_snippet(lesson.content, query),
            )
            for lesson, module, course in result.all()
        ]

    # ------------------------------------------------------------------
    # Progress
    # ------------------------------------------------------------------

    async def get_progress(self, user_id: uuid.UUID) -> list[LearningProgress]:
        """Return all progress rows for a user."""
        result = await self.db.execute(
            select(LearningProgress).where(LearningProgress.user_id == user_id)
        )
        return list(result.scalars().all())

    async def upsert_progress(
        self,
        user_id: uuid.UUID,
        lesson_id: uuid.UUID,
        body: UpdateProgressRequest,
    ) -> LearningProgress:
        """Insert or update the student's progress for a lesson.

        Refreshes last_accessed_at on every call.
        Raises NotFoundError if lesson_id has no content_refs lesson row.
        """
        # lesson_id is a content_refs id (legacy lesson ids were backfilled
        # 1:1); reject unknown ids up front rather than via an FK violation.
        await ContentRefService(self.db).get(lesson_id, ContentKind.LESSON)

        result = await self.db.execute(
            select(LearningProgress).where(
                LearningProgress.user_id == user_id,
                LearningProgress.lesson_id == lesson_id,
            )
        )
        progress = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if progress is None:
            progress = LearningProgress(
                user_id=user_id,
                lesson_id=lesson_id,
                status=body.status,
                completion_pct=body.completion_pct,
                last_accessed_at=now,
            )
            self.db.add(progress)
        else:
            progress.status = body.status
            progress.completion_pct = body.completion_pct
            progress.last_accessed_at = now

        await self.db.commit()
        await self.db.refresh(progress)
        return progress
