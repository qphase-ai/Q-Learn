from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.common import StandardResponse

router = APIRouter()


# Sign-up / sign-in / token refresh are handled by Supabase Auth on the client.
# The API only exposes the synced local profile for the authenticated user.
@router.get("/me", response_model=StandardResponse[UserResponse])
async def me(current_user=Depends(get_current_user)):
    return StandardResponse(data=UserResponse.model_validate(current_user))
