"""Tests for the internal content-refs router the Payload CMS calls.

Hermetic — dependency_overrides for the DB and settings, service monkeypatched.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_settings_dep
from app.exceptions import ConflictError
from app.main import app
from app.models.content_ref import ContentRef
from app.services import content_ref_service as svc_module

SECRET = "test-cms-secret"
URL = "/api/v1/internal/content-refs"


def _settings(secret: str):
    return get_settings().model_copy(update={"cms_webhook_secret": secret})


@pytest.fixture
async def clean_overrides():
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = lambda: (x for x in [MagicMock()])
    app.dependency_overrides[get_settings_dep] = lambda: _settings(SECRET)
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_register_returns_ref(client, clean_overrides, monkeypatch):
    ref = ContentRef(id=uuid.uuid4(), kind="lesson", payload_id="42")
    register = AsyncMock(return_value=ref)
    monkeypatch.setattr(svc_module.ContentRefService, "register", register)

    response = await client.post(
        URL, json={"kind": "lesson", "payload_id": "42"}, headers={"X-CMS-Secret": SECRET}
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"id": str(ref.id), "kind": "lesson", "payload_id": "42"}
    register.assert_awaited_once()
    assert register.await_args.args[2] is None


async def test_register_forwards_ref_id(client, clean_overrides, monkeypatch):
    ref_id = uuid.uuid4()
    ref = ContentRef(id=ref_id, kind="lesson", payload_id="42")
    register = AsyncMock(return_value=ref)
    monkeypatch.setattr(svc_module.ContentRefService, "register", register)

    await client.post(
        URL,
        json={"kind": "lesson", "payload_id": "42", "ref_id": str(ref_id)},
        headers={"X-CMS-Secret": SECRET},
    )

    assert register.await_args.args[2] == ref_id


async def test_conflict_maps_to_409(client, clean_overrides, monkeypatch):
    monkeypatch.setattr(
        svc_module.ContentRefService, "register", AsyncMock(side_effect=ConflictError("taken"))
    )

    response = await client.post(
        URL, json={"kind": "lesson", "payload_id": "42"}, headers={"X-CMS-Secret": SECRET}
    )

    assert response.status_code == 409


@pytest.mark.parametrize("headers", [{}, {"X-CMS-Secret": "wrong"}])
async def test_rejects_missing_or_wrong_secret(client, clean_overrides, monkeypatch, headers):
    register = AsyncMock()
    monkeypatch.setattr(svc_module.ContentRefService, "register", register)

    response = await client.post(URL, json={"kind": "lesson", "payload_id": "42"}, headers=headers)

    assert response.status_code == 401
    register.assert_not_awaited()


async def test_disabled_when_secret_unset(client, clean_overrides, monkeypatch):
    app.dependency_overrides[get_settings_dep] = lambda: _settings("")
    register = AsyncMock()
    monkeypatch.setattr(svc_module.ContentRefService, "register", register)

    response = await client.post(
        URL, json={"kind": "lesson", "payload_id": "42"}, headers={"X-CMS-Secret": ""}
    )

    assert response.status_code == 403
    register.assert_not_awaited()


async def test_rejects_unknown_kind(client, clean_overrides):
    response = await client.post(
        URL, json={"kind": "course", "payload_id": "42"}, headers={"X-CMS-Secret": SECRET}
    )

    assert response.status_code == 422
