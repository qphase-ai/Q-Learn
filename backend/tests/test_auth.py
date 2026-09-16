import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt

from app.config import get_settings
from app.main import app


def make_supabase_token(user_id: str, email: str, *, secret: str | None = None) -> str:
    """Mint a token shaped like a Supabase Auth access token (HS256, aud=authenticated)."""
    settings = get_settings()
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": "authenticated",
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        secret or settings.supabase_jwt_secret,
        algorithm="HS256",
    )


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_me_syncs_new_user(client: AsyncClient):
    user_id = str(uuid.uuid4())
    token = make_supabase_token(user_id, "new@qlearn.dev")
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["id"] == user_id
    assert data["email"] == "new@qlearn.dev"
    assert data["role"] == "student"
    assert data["subscription_status"] == "free"


async def test_me_is_idempotent(client: AsyncClient):
    user_id = str(uuid.uuid4())
    token = make_supabase_token(user_id, "repeat@qlearn.dev")
    first = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    second = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert first.status_code == second.status_code == 200
    assert first.json()["data"]["id"] == second.json()["data"]["id"] == user_id


async def test_me_rejects_token_signed_with_wrong_secret(client: AsyncClient):
    token = make_supabase_token(str(uuid.uuid4()), "bad@qlearn.dev", secret="not-the-real-secret")
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


async def test_me_requires_token(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)
