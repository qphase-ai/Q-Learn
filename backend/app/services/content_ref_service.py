"""Content ref service — resolves the content_refs integration boundary.

content_refs gives learner-state rows a stable, backend-owned id for content
that Payload authors. This service is the only place that reads or mutates it.
Like the other services it returns ORM objects and raises from app.exceptions.
"""
import uuid

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.content_ref import (
    LEGACY_PAYLOAD_PREFIX,
    UQ_CONTENT_REFS_KIND_PAYLOAD_ID,
    ContentKind,
    ContentRef,
)

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
        try:
            await self.db.commit()
        except IntegrityError as exc:
            # A concurrent bind of the same payload_id passed the check above
            # and committed first; the unique constraint is the real guard.
            await self.db.rollback()
            if UQ_CONTENT_REFS_KIND_PAYLOAD_ID in str(exc.orig):
                raise ConflictError(
                    f"Payload {kind.value} {payload_id} is already bound to another ref"
                ) from exc
            raise
        await self.db.refresh(ref)
        logger.info("content_ref_bound", ref_id=str(ref_id), kind=kind.value, payload_id=payload_id)
        return ref

    async def register(
        self, kind: ContentKind, payload_id: str, ref_id: uuid.UUID | None = None
    ) -> ContentRef:
        """Resolve the ref for a published Payload document, creating it if new.

        Called by the CMS on publish. Idempotent: re-publishing returns the
        same ref. When the CMS already carries a ref id (the legacy import
        sets it to the legacy lesson UUID) the sentinel is bound instead of a
        new ref being minted, so learner state recorded before the switch is
        kept. Ref ids are only ever minted here, never accepted from the CMS.
        """
        if not payload_id or payload_id.startswith(LEGACY_PAYLOAD_PREFIX):
            raise ValidationError(f"Invalid Payload id {payload_id!r}")

        existing = await self.find_by_payload_id(kind, payload_id)
        if existing is not None:
            if ref_id is not None and existing.id != ref_id:
                raise ConflictError(
                    f"Payload {kind.value} {payload_id} is already bound to ref {existing.id}"
                )
            return existing

        if ref_id is not None:
            return await self.bind_payload_id(ref_id, kind, payload_id)

        ref = ContentRef(kind=kind.value, payload_id=payload_id)
        self.db.add(ref)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            # A concurrent register of the same document committed first.
            await self.db.rollback()
            if UQ_CONTENT_REFS_KIND_PAYLOAD_ID not in str(exc.orig):
                raise
            winner = await self.find_by_payload_id(kind, payload_id)
            if winner is None:
                raise
            return winner
        await self.db.refresh(ref)
        logger.info("content_ref_registered", ref_id=str(ref.id), kind=kind.value, payload_id=payload_id)
        return ref
