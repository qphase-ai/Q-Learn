import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.limiter import limiter
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.classroom import (
    ClassroomSessionResponse,
    ClassroomStateResponse,
    InterruptResult,
    SessionCreated,
    TurnAccepted,
    TurnRequest,
)
from app.schemas.common import StandardResponse
from app.services import classroom_service

router = APIRouter()
_settings = get_settings()


@router.post("/sessions", status_code=201, response_model=StandardResponse[SessionCreated])
@limiter.limit(_settings.classroom_rate_limit_sessions)
async def create_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    session = await classroom_service.create_session(db, current_user.id)
    return StandardResponse(data=SessionCreated(session_id=session.id))


@router.post("/sessions/{session_id}/turns", status_code=202, response_model=StandardResponse[TurnAccepted])
@limiter.limit(_settings.classroom_rate_limit_turns)
async def start_turn(
    request: Request,
    session_id: uuid.UUID,
    body: TurnRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    turn_id, is_new = await classroom_service.start_turn(
        db, current_user.id, session_id, body.message, body.client_message_id
    )
    if is_new:
        background.add_task(classroom_service.run_turn, session_id, current_user.id, turn_id, body.message)
    return StandardResponse(data=TurnAccepted(turn_id=turn_id))


@router.post("/sessions/{session_id}/interrupt", response_model=StandardResponse[InterruptResult])
@limiter.limit(_settings.classroom_rate_limit_turns)
async def interrupt_turn(
    request: Request,
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    interrupted = await classroom_service.interrupt(db, current_user.id, session_id)
    return StandardResponse(data=InterruptResult(interrupted=interrupted))


@router.get("/sessions/{session_id}", response_model=StandardResponse[ClassroomSessionResponse])
@limiter.limit(_settings.classroom_rate_limit_reads)
async def get_session(
    request: Request,
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = await classroom_service.get_session_view(db, session_id, current_user.id)
    return StandardResponse(data=data)


@router.get("/sessions/{session_id}/state", response_model=StandardResponse[ClassroomStateResponse])
@limiter.limit(_settings.classroom_rate_limit_reads)
async def get_state(
    request: Request,
    session_id: uuid.UUID,
    after_seq: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = await classroom_service.get_state(db, session_id, current_user.id, after_seq)
    return StandardResponse(data=data)
