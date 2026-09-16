from sqlalchemy import String, Boolean, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    # PK is the Supabase auth.users UUID — populated on first authenticated request.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    # Supabase Auth owns credentials; kept nullable only for legacy rows.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="student", nullable=False)
    subscription_status: Mapped[str] = mapped_column(String(20), default="free", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="user", uselist=False)
    subscription: Mapped["UserSubscription"] = relationship("UserSubscription", back_populates="user", uselist=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    institution: Mapped[str | None] = mapped_column(String(255))

    user: Mapped["User"] = relationship("User", back_populates="profile")
