import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.common import StandardResponse
from app.schemas.tutor import TutorChatRequest, TutorChatAccepted, TutorSessionResponse
from app.services.tutor_service import start_message, run_and_stream, get_session

router = APIRouter()


@router.post(
    "/chat",
    status_code=202,
    response_model=StandardResponse[TutorChatAccepted],
)
async def chat(
    body: TutorChatRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    session_id = await start_message(db, current_user.id, body)
    background.add_task(
        run_and_stream, session_id, current_user.id, body.message, body.lesson_id
    )
    return StandardResponse(
        data=TutorChatAccepted(session_id=session_id, status="pending")
    )


@router.get(
    "/sessions/{session_id}",
    response_model=StandardResponse[TutorSessionResponse],
)
async def get_tutor_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = await get_session(db, session_id, current_user.id)
    return StandardResponse(data=data)
