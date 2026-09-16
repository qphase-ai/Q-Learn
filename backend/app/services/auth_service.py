"""Authentication is delegated to Supabase Auth.

The frontend signs in directly with Supabase (`@supabase/supabase-js`) and sends
the resulting access token as `Authorization: Bearer <token>`. This service only
*verifies* that token (HS256 with the project JWT secret) and syncs a local
`public.users` row that owns app-specific data — role and subscription status —
which Supabase does not track.
"""
import uuid

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.exceptions import UnauthorizedError
from app.models.user import User


class AuthService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def get_user_from_token(self, token: str) -> User:
        """Verify a Supabase access token and return the synced local user."""
        try:
            payload = jwt.decode(
                token,
                self.settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except JWTError:
            raise UnauthorizedError("Invalid or expired token")

        subject = payload.get("sub")
        if not subject:
            raise UnauthorizedError("Invalid token: missing subject")
        try:
            user_id = uuid.UUID(subject)
        except ValueError:
            raise UnauthorizedError("Invalid token: subject is not a UUID")

        return await self._sync_user(user_id, payload.get("email"))

    async def _sync_user(self, user_id: uuid.UUID, email: str | None) -> User:
        """Upsert the local user row keyed by the Supabase user id."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                id=user_id,
                email=email or "",
                role="student",
                subscription_status="free",
                is_active=True,
                is_verified=True,
            )
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
        elif email and user.email != email:
            user.email = email
            await self.db.commit()
            await self.db.refresh(user)

        if not user.is_active:
            raise UnauthorizedError("User is inactive")
        return user
