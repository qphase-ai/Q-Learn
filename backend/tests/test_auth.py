import uuid
from datetime import datetime, timedelta, timezone

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from httpx import AsyncClient, ASGITransport
from jose import jwt
from jose import jwk as jose_jwk

import app.services.auth_service as auth_service
from app.config import get_settings
from app.database import get_db
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


def make_es256_keypair(kid: str) -> tuple[bytes, dict]:
    """Generate an EC P-256 keypair; return (private PEM, public JWK) for ES256.

    Mirrors how Supabase projects on JWT signing keys sign access tokens.
    """
    priv = ec.generate_private_key(ec.SECP256R1())
    priv_pem = priv.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    pub_pem = priv.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    pub_jwk = jose_jwk.construct(pub_pem, algorithm="ES256").to_dict()
    pub_jwk = {k: (v.decode() if isinstance(v, bytes) else v) for k, v in pub_jwk.items()}
    pub_jwk["kid"] = kid
    return priv_pem, pub_jwk


def make_es256_token(user_id: str, email: str, priv_pem: bytes, kid: str) -> str:
    """Mint an ES256-signed Supabase-shaped access token carrying `kid`."""
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": "authenticated",
            "role": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        priv_pem,
        algorithm="ES256",
        headers={"kid": kid},
    )


class _FakeResp:
    def __init__(self, data: dict):
        self._data = data

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict:
        return self._data


class _FakeAsyncClient:
    """Minimal stand-in for httpx.AsyncClient serving a fixed JWKS payload."""

    def __init__(self, data: dict):
        self._data = data

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, _url: str) -> _FakeResp:
        return _FakeResp(self._data)


class _FakeExecuteResult:
    def __init__(self, user):
        self._user = user

    def scalar_one_or_none(self):
        return self._user


class _FakeSession:
    """In-memory stand-in for AsyncSession backing ``AuthService._sync_user``.

    Keeps the auth tests hermetic (no Postgres): the only DB access on the
    ``/me`` path is a select-by-id then an optional insert, so an id-keyed dict
    is enough. Shared across requests within a test so the sync is idempotent.
    """

    def __init__(self, store: dict):
        self._store = store
        self._pending = None

    async def execute(self, stmt):
        # The sync only ever runs `select(User).where(User.id == <uuid>)`.
        user_id = stmt.whereclause.right.value
        return _FakeExecuteResult(self._store.get(user_id))

    def add(self, obj):
        self._pending = obj

    async def commit(self):
        if self._pending is not None:
            self._store[self._pending.id] = self._pending
            self._pending = None

    async def refresh(self, obj):
        return None


@pytest.fixture(autouse=True)
def fake_db():
    """Route ``get_db`` to an in-memory session so /me needs no live Postgres."""
    store: dict = {}

    async def _override_get_db():
        yield _FakeSession(store)

    app.dependency_overrides[get_db] = _override_get_db
    yield store
    app.dependency_overrides.pop(get_db, None)


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


async def test_me_accepts_es256_token_from_cached_jwks(client: AsyncClient, monkeypatch):
    """ES256 tokens (Supabase JWT signing keys) verify against the JWKS."""
    kid = "test-es256-cached"
    priv_pem, pub_jwk = make_es256_keypair(kid)
    monkeypatch.setitem(auth_service._jwks_cache, kid, pub_jwk)

    user_id = str(uuid.uuid4())
    token = make_es256_token(user_id, "es256@qlearn.dev", priv_pem, kid)
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["data"]["id"] == user_id


async def test_me_fetches_jwks_for_es256_on_cache_miss(client: AsyncClient, monkeypatch):
    """An unknown kid triggers a one-time JWKS fetch, then verifies."""
    kid = "test-es256-fetch"
    priv_pem, pub_jwk = make_es256_keypair(kid)
    auth_service._jwks_cache.clear()
    monkeypatch.setattr(
        auth_service.httpx, "AsyncClient", lambda *a, **k: _FakeAsyncClient({"keys": [pub_jwk]})
    )

    user_id = str(uuid.uuid4())
    token = make_es256_token(user_id, "fetch@qlearn.dev", priv_pem, kid)
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["data"]["id"] == user_id


async def test_me_rejects_es256_token_with_wrong_key(client: AsyncClient, monkeypatch):
    """A token signed by a different ES256 key than JWKS advertises is rejected."""
    kid = "test-es256-mismatch"
    signing_priv, _ = make_es256_keypair(kid)
    _, advertised_jwk = make_es256_keypair(kid)  # different key, same kid
    monkeypatch.setitem(auth_service._jwks_cache, kid, advertised_jwk)

    token = make_es256_token(str(uuid.uuid4()), "bad@qlearn.dev", signing_priv, kid)
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


async def test_me_rejects_unsupported_algorithm(client: AsyncClient):
    """Algorithms outside HS256/ES256/RS256 are refused before any key lookup."""
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "hs512@qlearn.dev",
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        "some-secret",
        algorithm="HS512",
    )
    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
