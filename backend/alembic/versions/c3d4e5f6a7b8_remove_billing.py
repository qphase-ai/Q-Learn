"""remove billing tables and subscription_status

Revision ID: c3d4e5f6a7b8
Revises: 80be607aeeb4
Branch labels: None
Depends on: None
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "80be607aeeb4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("billing_events")
    op.drop_table("user_subscriptions")
    op.drop_table("subscription_plans")
    op.drop_column("users", "subscription_status")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "subscription_status",
            sa.String(20),
            nullable=False,
            server_default="free",
        ),
    )
    op.create_table(
        "subscription_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("price_inr", sa.Integer(), default=0),
        sa.Column("razorpay_plan_id", sa.String(100), nullable=True),
        sa.Column("billing_cycle", sa.String(20), nullable=True),
        sa.Column("features", postgresql.JSON(), default=dict),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "user_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("subscription_plans.id"),
        ),
        sa.Column("razorpay_subscription_id", sa.String(100), unique=True, nullable=True),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_table(
        "billing_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("razorpay_event_id", sa.String(100), unique=True, nullable=False),
        sa.Column("payload", postgresql.JSON(), default=dict),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
