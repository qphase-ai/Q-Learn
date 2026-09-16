"""enable row level security on all public tables

The API connects with the Supabase service_role key (or the Postgres superuser
locally), both of which bypass RLS — so enabling RLS with no policies has no
effect on the backend while closing direct PostgREST access via the public
anon key. Add policies later if any table must be reachable by the anon/
authenticated roles directly.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-16

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = [
    "alembic_version", "coding_challenges", "courses", "knowledge_documents",
    "subscription_plans", "users", "agent_sessions", "billing_events",
    "challenge_attempts", "circuits", "document_chunks", "modules",
    "user_profiles", "user_subscriptions", "agent_messages", "circuit_executions",
    "knowledge_embeddings", "lessons", "concepts", "student_progress",
    "quiz_questions", "skill_mastery", "quiz_attempts",
]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE "public"."{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE "public"."{table}" DISABLE ROW LEVEL SECURITY')
