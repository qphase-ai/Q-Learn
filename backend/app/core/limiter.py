"""slowapi limiter shared by the AI Classroom routes.

Applied per route with `@limiter.limit(...)` only — no global middleware, so the
rest of the API is unaffected. The key is the caller's bearer token (hashed), i.e.
effectively per user, falling back to the client address.
"""
import hashlib

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded


def rate_limit_key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer ") and len(auth) > 7:
        return "tok:" + hashlib.sha256(auth[7:].encode()).hexdigest()[:24]
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return "ip:" + forwarded
    return "ip:" + (request.client.host if request.client else "unknown")


# key_style="endpoint": one bucket per route handler, not per URL (the URL contains the session id).
limiter = Limiter(key_func=rate_limit_key, headers_enabled=False, key_style="endpoint")


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Same error envelope as QlearnError responses."""
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": {"code": "RATE_LIMITED", "message": f"Rate limit exceeded: {exc.detail}", "details": None},
        },
    )
