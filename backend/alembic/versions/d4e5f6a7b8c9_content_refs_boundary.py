"""add content_refs boundary and repoint learner-state FKs

student_progress.lesson_id and quiz_questions.lesson_id stop referencing the
legacy `lessons` table and reference `content_refs` instead, so lessons can
move into Payload's `payload` schema without cross-schema FKs.

Backfill reuses each lesson's UUID as its content_refs.id, so no learner-state
row changes and API lesson ids stay valid. payload_id holds a 'legacy:<uuid>'
sentinel until the Payload import binds the real document id.

Downgrade restores the FKs to `lessons`; it fails (safely, inside the
transaction) if content_refs by then holds ids with no matching lesson.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Postgres default names — the initial schema created these FKs unnamed.
PROGRESS_FK = "student_progress_lesson_id_fkey"
QUIZ_FK = "quiz_questions_lesson_id_fkey"


def upgrade() -> None:
    op.create_table(
        "content_refs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("payload_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("kind", "payload_id", name="uq_content_refs_kind_payload_id"),
        sa.CheckConstraint(
            "kind IN ('curriculum', 'level', 'module', 'lesson')",
            name="ck_content_refs_kind",
        ),
    )
    op.execute('ALTER TABLE "public"."content_refs" ENABLE ROW LEVEL SECURITY')

    op.execute(
        "INSERT INTO content_refs (id, payload_id, kind) "
        "SELECT id, 'legacy:' || id::text, 'lesson' FROM lessons"
    )

    op.drop_constraint(PROGRESS_FK, "student_progress", type_="foreignkey")
    op.create_foreign_key(
        PROGRESS_FK, "student_progress", "content_refs",
        ["lesson_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_constraint(QUIZ_FK, "quiz_questions", type_="foreignkey")
    op.create_foreign_key(
        QUIZ_FK, "quiz_questions", "content_refs",
        ["lesson_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(QUIZ_FK, "quiz_questions", type_="foreignkey")
    op.create_foreign_key(
        QUIZ_FK, "quiz_questions", "lessons",
        ["lesson_id"], ["id"], ondelete="SET NULL",
    )
    op.drop_constraint(PROGRESS_FK, "student_progress", type_="foreignkey")
    op.create_foreign_key(
        PROGRESS_FK, "student_progress", "lessons",
        ["lesson_id"], ["id"], ondelete="CASCADE",
    )
    op.drop_table("content_refs")
