"""Export the legacy courses/modules/lessons tables as JSON for the Payload import.

Step 3 of the migration in docs/Curriculum/cirrculum-store-architecture.md:

    python -m scripts.export_legacy_curriculum > legacy-curriculum.json
    cd ../cms && pnpm import:legacy ../backend/legacy-curriculum.json

Read-only. Lesson ids are exported as-is: they are also the content_refs ids
(migration d4e5f6a7b8c9), so the CMS stores them as `contentRefId` and binding
on publish keeps every learner-state row pointing at the same lesson.
"""
from __future__ import annotations

import asyncio
import json
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.learning import Course, Module


async def export(db: AsyncSession) -> dict:
    result = await db.execute(
        select(Course)
        .options(selectinload(Course.modules).selectinload(Module.lessons))
        .order_by(Course.order_index)
    )
    courses = result.scalars().all()
    return {
        "version": 1,
        "courses": [
            {
                "id": str(course.id),
                "title": course.title,
                "description": course.description,
                "difficulty": course.difficulty,
                "order_index": course.order_index,
                "modules": [
                    {
                        "id": str(module.id),
                        "title": module.title,
                        "description": module.description,
                        "order_index": module.order_index,
                        "lessons": [
                            {
                                "id": str(lesson.id),
                                "title": lesson.title,
                                "content": lesson.content,
                                "lesson_type": lesson.lesson_type,
                                "is_pro": lesson.is_pro,
                                "order_index": lesson.order_index,
                            }
                            for lesson in module.lessons
                        ],
                    }
                    for module in course.modules
                ],
            }
            for course in courses
        ],
    }


async def _main() -> None:
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        data = await export(db)
    json.dump(data, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    asyncio.run(_main())
