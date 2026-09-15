from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import get_settings, Settings
from app.exceptions import UnauthorizedError, PlanRequiredError

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


async def require_pro(current_user=Depends(get_current_user)):
    if current_user.subscription_status != "pro":
        raise PlanRequiredError("This feature requires a Pro subscription")
    return current_user


async def require_instructor(current_user=Depends(get_current_user)):
    if current_user.role not in ("instructor", "admin"):
        raise UnauthorizedError("Instructor role required")
    return current_user


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise UnauthorizedError("Admin role required")
    return current_user
