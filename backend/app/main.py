import asyncio
import contextlib

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings
from app.core.logging import configure_logging
from app.exceptions import QlearnError, qlearn_exception_handler
from app.rag.embeddings import warm_up
from app.routers import auth, circuits, content_refs, learning, tutor

configure_logging()
settings = get_settings()
logger = structlog.get_logger(__name__)


async def _warm_up_embeddings() -> None:
    """Load the embedding model off the event loop; log, never raise.

    A failure only means the first tutor turn loads the model itself.
    """
    try:
        await asyncio.to_thread(warm_up)
        logger.info("embedding_warmup")
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001 — best-effort preload
        logger.warning("embedding_warmup_failed", error=str(exc))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — preload the embedding model in the background so boot (and the
    # health check) never waits on it. Keep a reference so the task isn't
    # garbage-collected mid-flight and can be cancelled on shutdown.
    app.state.embedding_warmup = (
        asyncio.create_task(_warm_up_embeddings()) if settings.rag_warmup_embeddings else None
    )
    try:
        yield
    finally:
        # Shutdown — stop waiting on an unfinished warm-up. The worker thread
        # can't be interrupted; it ends on its own.
        task = app.state.embedding_warmup
        if task is not None and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


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
    app.include_router(circuits.router, prefix="/api/v1/circuits", tags=["circuits"])
    app.include_router(learning.router, prefix="/api/v1", tags=["learning"])
    app.include_router(tutor.router, prefix="/api/v1/tutor", tags=["tutor"])
    app.include_router(content_refs.router, prefix="/api/v1/internal", tags=["internal"])

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": settings.app_name}

    return app


app = create_app()
