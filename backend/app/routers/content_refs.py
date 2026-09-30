"""Internal endpoints the Payload CMS calls to maintain content_refs.

Not for browsers — authenticated with X-CMS-Secret, not a user JWT.
See docs/Curriculum/cirrculum-store-architecture.md § content_refs.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_cms_secret
from app.schemas.common import StandardResponse
from app.schemas.content_ref import ContentRefOut, RegisterContentRefRequest
from app.services.content_ref_service import ContentRefService

router = APIRouter(dependencies=[Depends(require_cms_secret)])


@router.post(
    "/content-refs",
    response_model=StandardResponse[ContentRefOut],
)
async def register_content_ref(
    body: RegisterContentRefRequest,
    db: AsyncSession = Depends(get_db),
):
    ref = await ContentRefService(db).register(body.kind, body.payload_id, body.ref_id)
    return StandardResponse(data=ContentRefOut.model_validate(ref))
