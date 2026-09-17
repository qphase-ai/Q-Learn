from pydantic import BaseModel, ConfigDict
import uuid


class LessonSummary(BaseModel):
    id: uuid.UUID
    title: str
    lesson_type: str
    is_pro: bool
    order_index: int

    model_config = ConfigDict(from_attributes=True)


class ModuleWithLessons(BaseModel):
    id: uuid.UUID
    title: str
    order_index: int
    lessons: list[LessonSummary]

    model_config = ConfigDict(from_attributes=True)


class CourseSummary(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    difficulty: str

    model_config = ConfigDict(from_attributes=True)


class CourseDetail(CourseSummary):
    modules: list[ModuleWithLessons]

    model_config = ConfigDict(from_attributes=True)


class ConceptOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None

    model_config = ConfigDict(from_attributes=True)


class LessonDetail(BaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    title: str
    content: str | None
    lesson_type: str
    is_pro: bool
    concepts: list[ConceptOut]

    model_config = ConfigDict(from_attributes=True)


class ProgressItem(BaseModel):
    lesson_id: uuid.UUID
    status: str
    completion_pct: float

    model_config = ConfigDict(from_attributes=True)


class UpdateProgressRequest(BaseModel):
    status: str = "in_progress"
    completion_pct: float = 0.0
