"""Content ref service — resolves the content_refs integration boundary.

content_refs gives learner-state rows a stable, backend-owned id for content
that Payload authors. This service is the only place that reads or mutates it.
Like the other services it returns ORM objects and raises from app.exceptions.
"""
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.content_ref import LEGACY_PAYLOAD_PREFIX, ContentKind, ContentRef

logger = structlog.get_logger(__name__)


class ContentRefService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, ref_id: uuid.UUID, kind: ContentKind) -> ContentRef:
        """Return the ref, or raise NotFoundError if absent or of another kind."""
        ref = await self.db.get(ContentRef, ref_id)
        if ref is None or ref.kind != kind:
            raise NotFoundError(f"{kind.value.capitalize()} {ref_id} not found")
        return ref

    async def find_by_payload_id(self, kind: ContentKind, payload_id: str) -> ContentRef | None:
        """Look up a ref by its Payload document id (uses the unique index)."""
        result = await self.db.execute(
            select(ContentRef).where(
                ContentRef.kind == kind,
                ContentRef.payload_id == payload_id,
            )
        )
        return result.scalar_one_or_none()

    async def bind_payload_id(
        self, ref_id: uuid.UUID, kind: ContentKind, payload_id: str
    ) -> ContentRef:
        """Replace a legacy sentinel with the real Payload document id.

        Idempotent when the ref is already bound to payload_id. A ref bound to
        a different real id is never rebound — learner state points at it.
        """
        if not payload_id or payload_id.startswith(LEGACY_PAYLOAD_PREFIX):
            raise ValidationError(f"Invalid Payload id {payload_id!r}")

        ref = await self.get(ref_id, kind)
        if ref.payload_id == payload_id:
            return ref
        if not ref.is_legacy:
            raise ConflictError(
                f"{kind.value.capitalize()} {ref_id} is already bound to Payload id {ref.payload_id}"
            )
        if await self.find_by_payload_id(kind, payload_id) is not None:
            raise ConflictError(f"Payload {kind.value} {payload_id} is already bound to another ref")

        ref.payload_id = payload_id
        await self.db.commit()
        await self.db.refresh(ref)
        logger.info("content_ref_bound", ref_id=str(ref_id), kind=kind.value, payload_id=payload_id)
        return ref
