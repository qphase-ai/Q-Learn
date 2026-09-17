import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import StandardResponse
from app.schemas.learning import (
    CourseSummary,
    CourseDetail,
    LessonDetail,
    ProgressItem,
    UpdateProgressRequest,
)
from app.services.learning_service import LearningService

router = APIRouter()


@router.get(
    "/courses",
    response_model=StandardResponse[list[CourseSummary]],
)
async def list_courses(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    courses = await LearningService(db).list_courses()
    return StandardResponse(data=[CourseSummary.model_validate(c) for c in courses])


@router.get(
    "/courses/{course_id}",
    response_model=StandardResponse[CourseDetail],
)
async def get_course_detail(
    course_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    course = await LearningService(db).get_course_detail(course_id)
    return StandardResponse(data=CourseDetail.model_validate(course))


@router.get(
    "/lessons/{lesson_id}",
    response_model=StandardResponse[LessonDetail],
)
async def get_lesson(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    lesson = await LearningService(db).get_lesson(lesson_id)
    return StandardResponse(data=LessonDetail.model_validate(lesson))


@router.get(
    "/progress",
    response_model=StandardResponse[list[ProgressItem]],
)
async def get_progress(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    progress = await LearningService(db).get_progress(current_user.id)
    return StandardResponse(data=[ProgressItem.model_validate(p) for p in progress])


@router.put(
    "/lessons/{lesson_id}/progress",
    response_model=StandardResponse[ProgressItem],
)
async def upsert_progress(
    lesson_id: uuid.UUID,
    body: UpdateProgressRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    progress = await LearningService(db).upsert_progress(current_user.id, lesson_id, body)
    return StandardResponse(data=ProgressItem.model_validate(progress))
