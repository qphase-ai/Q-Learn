from sqlalchemy import Float, Integer, ForeignKey, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import func
import uuid
from app.models.base import Base


class LearningProgress(Base):
    __tablename__ = "student_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(default="not_started")  # not_started | in_progress | completed
    completion_pct: Mapped[float] = mapped_column(Float, default=0.0)
    last_accessed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SkillMastery(Base):
    __tablename__ = "skill_mastery"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    concept_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"))
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)   # BKT 0.0–1.0
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    p_l0: Mapped[float] = mapped_column(Float, default=0.3)   # prior knowledge
    p_t: Mapped[float] = mapped_column(Float, default=0.09)   # learning rate
    p_g: Mapped[float] = mapped_column(Float, default=0.2)    # guess
    p_s: Mapped[float] = mapped_column(Float, default=0.1)    # slip
    common_errors: Mapped[list] = mapped_column(JSON, default=list)
    last_attempt_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
