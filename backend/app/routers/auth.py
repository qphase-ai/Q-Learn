from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import get_settings, Settings
from app.dependencies import get_current_user
from app.schemas.auth import RegisterRequest, LoginRequest, TokenPair, RefreshRequest, UserResponse
from app.schemas.common import StandardResponse
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=StandardResponse[TokenPair], status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    tokens = await service.register(body)
    return StandardResponse(data=tokens)


@router.post("/login", response_model=StandardResponse[TokenPair])
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    tokens = await service.login(body)
    return StandardResponse(data=tokens)


@router.post("/refresh", response_model=StandardResponse[TokenPair])
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    service = AuthService(db, settings)
    tokens = await service.refresh(body.refresh_token)
    return StandardResponse(data=tokens)


@router.get("/me", response_model=StandardResponse[UserResponse])
async def me(current_user=Depends(get_current_user)):
    return StandardResponse(data=UserResponse.model_validate(current_user))
