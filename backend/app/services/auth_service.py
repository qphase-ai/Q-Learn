"""Authentication is delegated to Supabase Auth.

The frontend signs in directly with Supabase (`@supabase/supabase-js`) and sends
the resulting access token as `Authorization: Bearer <token>`. This service only
*verifies* that token and syncs a local `public.users` row that owns app-specific
data — role and subscription status — which Supabase does not track.

Supabase signs access tokens with either the legacy shared HS256 secret or, for
projects using JWT signing keys, an asymmetric key (ES256/RS256) published via
JWKS. We verify by whatever algorithm the token declares, so both work.
"""
import uuid

import httpx
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.exceptions import UnauthorizedError
from app.models.user import User

_ASYMMETRIC_ALGS = ("ES256", "RS256")

# JWKS is small and rotates rarely; cache it in-process keyed by `kid`. On a
# cache miss (unknown kid, e.g. after a rotation) we refetch the set once.
_jwks_cache: dict[str, dict] = {}


async def _get_signing_key(jwks_url: str, kid: str) -> dict:
    """Return the JWK for `kid`, refetching the JWKS once on a cache miss."""
    key = _jwks_cache.get(kid)
    if key is not None:
        return key
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(jwks_url)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        raise UnauthorizedError("Unable to verify token signing key")
    _jwks_cache.clear()
    for jwk in data.get("keys", []):
        if jwk.get("kid"):
            _jwks_cache[jwk["kid"]] = jwk
    key = _jwks_cache.get(kid)
    if key is None:
        raise UnauthorizedError("Invalid token: unknown signing key")
    return key


class AuthService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def get_user_from_token(self, token: str) -> User:
        """Verify a Supabase access token and return the synced local user."""
        try:
            header = jwt.get_unverified_header(token)
        except JWTError:
            raise UnauthorizedError("Invalid or expired token")

        alg = header.get("alg")
        key: str | dict
        if alg == "HS256":
            key = self.settings.supabase_jwt_secret
        elif alg in _ASYMMETRIC_ALGS:
            kid = header.get("kid")
            if not kid:
                raise UnauthorizedError("Invalid token: missing key id")
            jwks_url = (
                f"{self.settings.supabase_url.rstrip('/')}"
                "/auth/v1/.well-known/jwks.json"
            )
            key = await _get_signing_key(jwks_url, kid)
        else:
            raise UnauthorizedError("Invalid token: unsupported algorithm")

        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience="authenticated",
            )
        except JWTError:
            raise UnauthorizedError("Invalid or expired token")

        subject = payload.get("sub")
        if not subject:
            raise UnauthorizedError("Invalid token: missing subject")
        try:
            user_id = uuid.UUID(subject)
        except ValueError:
            raise UnauthorizedError("Invalid token: subject is not a UUID")

        return await self._sync_user(user_id, payload.get("email"))

    async def _sync_user(self, user_id: uuid.UUID, email: str | None) -> User:
        """Upsert the local user row keyed by the Supabase user id."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                id=user_id,
                email=email or "",
                role="student",
                subscription_status="free",
                is_active=True,
                is_verified=True,
            )
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
        elif email and user.email != email:
            user.email = email
            await self.db.commit()
            await self.db.refresh(user)

        if not user.is_active:
            raise UnauthorizedError("User is inactive")
        return user
