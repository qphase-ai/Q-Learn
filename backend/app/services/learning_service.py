"""Learning service — business logic for courses, lessons, and student progress.

Design choice: all read methods return ORM objects (Course, Lesson,
LearningProgress). The router serialises them to Pydantic schemas via
``model_validate`` / ``from_attributes=True``. This mirrors the pattern in
circuits_service and keeps the service free of schema imports.

The only exception is upsert_progress, which also returns an ORM object so
the router can call model_validate(LearningProgress) -> ProgressItem.
"""
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundError
from app.models.learning import Course, Lesson, Module
from app.models.progress import LearningProgress
from app.schemas.learning import UpdateProgressRequest

logger = structlog.get_logger(__name__)


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
        return result.scalars().all()

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

    # ------------------------------------------------------------------
    # Progress
    # ------------------------------------------------------------------

    async def get_progress(self, user_id: uuid.UUID) -> list[LearningProgress]:
        """Return all progress rows for a user."""
        result = await self.db.execute(
            select(LearningProgress).where(LearningProgress.user_id == user_id)
        )
        return result.scalars().all()

    async def upsert_progress(
        self,
        user_id: uuid.UUID,
        lesson_id: uuid.UUID,
        body: UpdateProgressRequest,
    ) -> LearningProgress:
        """Insert or update the student's progress for a lesson.

        Refreshes last_accessed_at on every call.
        """
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
