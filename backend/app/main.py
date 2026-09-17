from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings
from app.exceptions import QlearnError, qlearn_exception_handler
from app.routers import auth, billing, circuits, learning

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(QlearnError, qlearn_exception_handler)

    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
    app.include_router(circuits.router, prefix="/api/v1/circuits", tags=["circuits"])
    app.include_router(learning.router, prefix="/api/v1", tags=["learning"])

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": settings.app_name}

    return app


app = create_app()
