import structlog

from app.core.logging import configure_logging


def test_exception_logs_do_not_include_local_variables(capsys):
    """Regression: rich tracebacks with show_locals leaked the Groq API key into logs."""
    configure_logging()
    logger = structlog.get_logger("test")

    def call_provider():
        api_key = "gsk_SECRET_SHOULD_NOT_BE_LOGGED"  # noqa: F841 — the leaked local
        raise RuntimeError("model_not_found")

    try:
        call_provider()
    except RuntimeError:
        logger.exception("tutor_stream_failed")

    out = capsys.readouterr().out
    assert "tutor_stream_failed" in out
    assert "RuntimeError: model_not_found" in out
    assert "gsk_SECRET_SHOULD_NOT_BE_LOGGED" not in out
