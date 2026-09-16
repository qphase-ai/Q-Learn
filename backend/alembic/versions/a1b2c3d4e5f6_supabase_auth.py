"""supabase auth: users.hashed_password nullable

Supabase Auth owns credentials, so the local users table no longer stores a
password hash. Kept as a nullable column for any legacy rows rather than dropped.

Revision ID: a1b2c3d4e5f6
Revises: fcf79f2542fd
Create Date: 2026-09-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fcf79f2542fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'hashed_password', existing_type=sa.String(length=255), nullable=False)
