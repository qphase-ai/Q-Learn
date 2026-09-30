"""Tests for ContentRefService.

Hermetic — no real DB connections. All DB I/O is mocked with AsyncMock,
following test_learning_service.py.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.content_ref import UQ_CONTENT_REFS_KIND_PAYLOAD_ID, ContentKind, ContentRef


def _integrity_error(constraint: str) -> IntegrityError:
    """Mimic the IntegrityError SQLAlchemy raises when Postgres rejects a commit."""
    orig = Exception(f'duplicate key value violates unique constraint "{constraint}"')
    return IntegrityError("UPDATE content_refs ...", {}, orig)


def _make_ref(*, kind: str = "lesson", payload_id: str | None = None) -> ContentRef:
    ref_id = uuid.uuid4()
    return ContentRef(id=ref_id, kind=kind, payload_id=payload_id or f"legacy:{ref_id}")


def _make_mock_db(get_returns=None) -> AsyncMock:
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.get = AsyncMock(return_value=get_returns)
    return db


def _scalar_one_or_none_result(item) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = item
    return result


class TestGet:

    async def test_returns_ref_of_matching_kind(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref()
        db = _make_mock_db(get_returns=ref)

        result = await ContentRefService(db).get(ref.id, ContentKind.LESSON)

        assert result is ref
        db.get.assert_awaited_once_with(ContentRef, ref.id)

    async def test_raises_not_found_when_missing(self):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db(get_returns=None)

        with pytest.raises(NotFoundError):
            await ContentRefService(db).get(uuid.uuid4(), ContentKind.LESSON)

    async def test_raises_not_found_when_kind_differs(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref(kind="module")
        db = _make_mock_db(get_returns=ref)

        with pytest.raises(NotFoundError):
            await ContentRefService(db).get(ref.id, ContentKind.LESSON)


class TestFindByPayloadId:

    async def test_returns_match(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref(payload_id="42")
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(ref))

        result = await ContentRefService(db).find_by_payload_id(ContentKind.LESSON, "42")

        assert result is ref
        db.execute.assert_awaited_once()

    async def test_returns_none_when_absent(self):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        assert await ContentRefService(db).find_by_payload_id(ContentKind.LESSON, "42") is None


class TestBindPayloadId:

    async def test_replaces_legacy_sentinel(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref()
        db = _make_mock_db(get_returns=ref)
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        result = await ContentRefService(db).bind_payload_id(ref.id, ContentKind.LESSON, "42")

        assert result is ref
        assert ref.payload_id == "42"
        assert ref.is_legacy is False
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once_with(ref)

    async def test_is_idempotent_for_same_id(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref(payload_id="42")
        db = _make_mock_db(get_returns=ref)

        result = await ContentRefService(db).bind_payload_id(ref.id, ContentKind.LESSON, "42")

        assert result is ref
        db.commit.assert_not_awaited()

    async def test_refuses_to_overwrite_a_bound_ref(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref(payload_id="42")
        db = _make_mock_db(get_returns=ref)

        with pytest.raises(ConflictError):
            await ContentRefService(db).bind_payload_id(ref.id, ContentKind.LESSON, "99")
        assert ref.payload_id == "42"
        db.commit.assert_not_awaited()

    async def test_refuses_payload_id_already_bound_elsewhere(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref()
        other = _make_ref(payload_id="42")
        db = _make_mock_db(get_returns=ref)
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(other))

        with pytest.raises(ConflictError):
            await ContentRefService(db).bind_payload_id(ref.id, ContentKind.LESSON, "42")
        assert ref.is_legacy is True
        db.commit.assert_not_awaited()

    @pytest.mark.parametrize("bad", ["", "legacy:abc"])
    async def test_rejects_empty_or_sentinel_payload_id(self, bad):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db(get_returns=_make_ref())

        with pytest.raises(ValidationError):
            await ContentRefService(db).bind_payload_id(uuid.uuid4(), ContentKind.LESSON, bad)
        db.get.assert_not_awaited()

    async def test_raises_not_found_for_unknown_ref(self):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db(get_returns=None)

        with pytest.raises(NotFoundError):
            await ContentRefService(db).bind_payload_id(uuid.uuid4(), ContentKind.LESSON, "42")

    async def test_concurrent_bind_race_raises_conflict(self):
        """A bind that loses a race at commit is a 409, not a raw IntegrityError."""
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref()
        db = _make_mock_db(get_returns=ref)
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))
        db.commit = AsyncMock(side_effect=_integrity_error(UQ_CONTENT_REFS_KIND_PAYLOAD_ID))

        with pytest.raises(ConflictError):
            await ContentRefService(db).bind_payload_id(ref.id, ContentKind.LESSON, "42")
        db.rollback.assert_awaited_once()
        db.refresh.assert_not_awaited()

    async def test_other_integrity_errors_are_reraised(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref()
        db = _make_mock_db(get_returns=ref)
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))
        db.commit = AsyncMock(side_effect=_integrity_error("ck_content_refs_kind"))

        with pytest.raises(IntegrityError):
            await ContentRefService(db).bind_payload_id(ref.id, ContentKind.LESSON, "42")
        db.rollback.assert_awaited_once()


class TestRegister:

    async def test_returns_existing_ref_for_known_payload_id(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref(payload_id="42")
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(ref))

        result = await ContentRefService(db).register(ContentKind.LESSON, "42")

        assert result is ref
        db.add.assert_not_called()
        db.commit.assert_not_awaited()

    async def test_existing_ref_with_matching_ref_id_is_idempotent(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref(payload_id="42")
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(ref))

        assert await ContentRefService(db).register(ContentKind.LESSON, "42", ref.id) is ref

    async def test_existing_ref_with_different_ref_id_conflicts(self):
        from app.services.content_ref_service import ContentRefService

        ref = _make_ref(payload_id="42")
        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(ref))

        with pytest.raises(ConflictError):
            await ContentRefService(db).register(ContentKind.LESSON, "42", uuid.uuid4())

    async def test_binds_legacy_ref_when_ref_id_given(self):
        from app.services.content_ref_service import ContentRefService

        legacy = _make_ref()
        db = _make_mock_db(get_returns=legacy)
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        result = await ContentRefService(db).register(ContentKind.LESSON, "42", legacy.id)

        assert result is legacy
        assert legacy.payload_id == "42"
        db.add.assert_not_called()

    async def test_unknown_ref_id_is_not_minted(self):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db(get_returns=None)
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        with pytest.raises(NotFoundError):
            await ContentRefService(db).register(ContentKind.LESSON, "42", uuid.uuid4())
        db.add.assert_not_called()

    async def test_creates_new_ref(self):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))

        result = await ContentRefService(db).register(ContentKind.LESSON, "42")

        db.add.assert_called_once_with(result)
        assert result.kind == "lesson"
        assert result.payload_id == "42"
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once_with(result)

    async def test_concurrent_create_returns_the_winner(self):
        from app.services.content_ref_service import ContentRefService

        winner = _make_ref(payload_id="42")
        db = _make_mock_db()
        db.execute = AsyncMock(
            side_effect=[_scalar_one_or_none_result(None), _scalar_one_or_none_result(winner)]
        )
        db.commit = AsyncMock(side_effect=_integrity_error(UQ_CONTENT_REFS_KIND_PAYLOAD_ID))

        result = await ContentRefService(db).register(ContentKind.LESSON, "42")

        assert result is winner
        db.rollback.assert_awaited_once()

    async def test_other_integrity_errors_are_reraised(self):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db()
        db.execute = AsyncMock(return_value=_scalar_one_or_none_result(None))
        db.commit = AsyncMock(side_effect=_integrity_error("ck_content_refs_kind"))

        with pytest.raises(IntegrityError):
            await ContentRefService(db).register(ContentKind.LESSON, "42")

    @pytest.mark.parametrize("bad", ["", "legacy:abc"])
    async def test_rejects_empty_or_sentinel_payload_id(self, bad):
        from app.services.content_ref_service import ContentRefService

        db = _make_mock_db()
        db.execute = AsyncMock()

        with pytest.raises(ValidationError):
            await ContentRefService(db).register(ContentKind.LESSON, bad)
        db.execute.assert_not_awaited()
