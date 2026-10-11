import structlog

from app.config import Settings

logger = structlog.get_logger(__name__)

_SCRUB_HEADERS = {"authorization", "cookie", "set-cookie", "x-cms-secret"}


def _scrub_event(event: dict, hint: dict) -> dict | None:
    """Drop headers/data that could carry secrets or student content.

    `send_default_pii=False` already excludes most of this, but request
    headers can still appear on the transaction; strip them explicitly
    rather than rely on a single setting.
    """
    request = event.get("request")
    if request:
        headers = request.get("headers")
        if headers:
            request["headers"] = {
                k: v for k, v in headers.items() if k.lower() not in _SCRUB_HEADERS
            }
        request.pop("data", None)
        request.pop("cookies", None)
    return event


def init_sentry(settings: Settings) -> None:
    """Initialize the Sentry SDK if SENTRY_DSN is configured.

    No-op with an empty DSN, so local dev and tests are unaffected. Call this
    once, before the FastAPI app starts handling requests.
    """
    if not settings.sentry_dsn:
        logger.info("sentry_disabled", reason="no SENTRY_DSN configured")
        return

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        # Keep in sync with the FastAPI app version in main.py.
        release="qlearn-api@0.1.0",
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            # Only error-level+ logs become Sentry events; structlog remains
            # the primary log sink (see app/core/logging.py).
            LoggingIntegration(level=None, event_level="ERROR"),
        ],
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
        send_default_pii=False,
        before_send=_scrub_event,
    )
    logger.info(
        "sentry_enabled",
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )
