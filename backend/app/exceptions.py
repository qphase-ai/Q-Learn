from fastapi import Request
from fastapi.responses import JSONResponse
from typing import Any


class QlearnError(Exception):
    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, details: Any = None):
        self.message = message
        self.details = details
        super().__init__(message)


class NotFoundError(QlearnError):
    status_code = 404
    code = "NOT_FOUND"


class UnauthorizedError(QlearnError):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(QlearnError):
    status_code = 403
    code = "FORBIDDEN"


class ValidationError(QlearnError):
    status_code = 422
    code = "VALIDATION_ERROR"


class ConflictError(QlearnError):
    status_code = 409
    code = "CONFLICT"


async def qlearn_exception_handler(request: Request, exc: QlearnError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )
