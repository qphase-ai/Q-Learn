import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.circuit import ExecuteCircuitRequest, ExecutionAccepted
from app.schemas.common import StandardResponse
from app.services.circuits_service import CircuitsService, run_and_publish

router = APIRouter()


@router.post(
    "/{circuit_id}/execute",
    status_code=202,
    response_model=StandardResponse[ExecutionAccepted],
)
async def execute_circuit(
    circuit_id: uuid.UUID,
    body: ExecuteCircuitRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    execution_id, qasm = await CircuitsService(db).start_execution(
        circuit_id, body, current_user.id
    )
    background.add_task(run_and_publish, circuit_id, execution_id, body.circuit, body.shots, qasm)
    return StandardResponse(data=ExecutionAccepted(execution_id=execution_id, status="pending"))
