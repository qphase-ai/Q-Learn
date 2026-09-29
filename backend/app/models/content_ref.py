"""content_refs — stable, backend-owned identity for CMS-authored content.

Payload owns what a lesson *is*; this table only gives learner-state rows
(student_progress, quiz_questions) something to foreign-key against.
Identity only — never titles, bodies, or ordering.
See docs/Curriculum/cirrculum-store-architecture.md § content_refs.
"""
import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ContentKind(StrEnum):
    CURRICULUM = "curriculum"
    LEVEL = "level"
    MODULE = "module"
    LESSON = "lesson"


# Rows backfilled from the legacy `lessons` table carry this prefix in
# payload_id until the Payload import binds the real document id.
LEGACY_PAYLOAD_PREFIX = "legacy:"


class ContentRef(Base):
    __tablename__ = "content_refs"
    __table_args__ = (
        UniqueConstraint("kind", "payload_id", name="uq_content_refs_kind_payload_id"),
        CheckConstraint(
            "kind IN ('curriculum', 'level', 'module', 'lesson')",
            name="ck_content_refs_kind",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payload_id: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    @property
    def is_legacy(self) -> bool:
        return self.payload_id.startswith(LEGACY_PAYLOAD_PREFIX)
