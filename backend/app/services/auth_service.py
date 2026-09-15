from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenPair
from app.exceptions import UnauthorizedError, ConflictError
from app.config import Settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def register(self, data: RegisterRequest) -> TokenPair:
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise ConflictError("Email already registered")

        user = User(
            email=data.email,
            hashed_password=pwd_context.hash(data.password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return self._issue_tokens(user)

    async def login(self, data: LoginRequest) -> TokenPair:
        result = await self.db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        if not user or not pwd_context.verify(data.password, user.hashed_password):
            raise UnauthorizedError("Invalid credentials")
        return self._issue_tokens(user)

    async def refresh(self, refresh_token: str) -> TokenPair:
        user = await self.get_user_from_token(refresh_token, token_type="refresh")
        return self._issue_tokens(user)

    async def get_user_from_token(self, token: str, token_type: str = "access") -> User:
        try:
            payload = jwt.decode(token, self.settings.secret_key, algorithms=[self.settings.algorithm])
            if payload.get("type") != token_type:
                raise UnauthorizedError("Invalid token type")
            user_id = payload.get("sub")
        except JWTError:
            raise UnauthorizedError("Invalid or expired token")

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or inactive")
        return user

    def _issue_tokens(self, user: User) -> TokenPair:
        return TokenPair(
            access_token=self._create_token(user, "access", self.settings.access_token_expire_minutes),
            refresh_token=self._create_token(user, "refresh", self.settings.refresh_token_expire_days * 24 * 60),
        )

    def _create_token(self, user: User, token_type: str, expire_minutes: int) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
        return jwt.encode(
            {"sub": str(user.id), "type": token_type, "role": user.role, "exp": expire},
            self.settings.secret_key,
            algorithm=self.settings.algorithm,
        )
