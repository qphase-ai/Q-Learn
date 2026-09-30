import hmac

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import get_settings, Settings
from app.exceptions import ForbiddenError, UnauthorizedError

security = HTTPBearer()


async def get_settings_dep() -> Settings:
    return get_settings()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
):
    from app.services.auth_service import AuthService
    token = credentials.credentials
    return await AuthService(db, settings).get_user_from_token(token)


async def require_instructor(current_user=Depends(get_current_user)):
    if current_user.role not in ("instructor", "admin"):
        raise UnauthorizedError("Instructor role required")
    return current_user


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise UnauthorizedError("Admin role required")
    return current_user


async def require_cms_secret(
    x_cms_secret: str | None = Header(default=None),
    settings: Settings = Depends(get_settings_dep),
) -> None:
    """Authenticate server-to-server calls from the Payload CMS.

    The CMS has no Supabase identity, so it proves itself with the shared
    CMS_WEBHOOK_SECRET. An unset secret disables the internal endpoints.
    """
    if not settings.cms_webhook_secret:
        raise ForbiddenError("CMS integration is not configured")
    if not x_cms_secret or not hmac.compare_digest(
        x_cms_secret.encode(), settings.cms_webhook_secret.encode()
    ):
        raise UnauthorizedError("Invalid CMS secret")
