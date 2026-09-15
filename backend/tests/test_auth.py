import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_register(client: AsyncClient):
    response = await client.post("/api/v1/auth/register", json={
        "email": "test@qlearn.dev",
        "password": "testpassword123",
        "display_name": "Test User",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]


async def test_login(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "login@qlearn.dev",
        "password": "testpassword123",
    })
    response = await client.post("/api/v1/auth/login", json={
        "email": "login@qlearn.dev",
        "password": "testpassword123",
    })
    assert response.status_code == 200
    assert response.json()["data"]["access_token"]


async def test_me(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "me@qlearn.dev",
        "password": "testpassword123",
    })
    token = reg.json()["data"]["access_token"]
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["data"]["email"] == "me@qlearn.dev"


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@qlearn.dev",
        "password": "correctpassword",
    })
    response = await client.post("/api/v1/auth/login", json={
        "email": "wrong@qlearn.dev",
        "password": "wrongpassword",
    })
    assert response.status_code == 401
