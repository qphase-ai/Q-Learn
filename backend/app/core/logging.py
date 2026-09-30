import structlog


def configure_logging() -> None:
    """Keep structlog's defaults but render exceptions without local variables.

    The default formatter (rich, show_locals=True) dumps every frame's locals, which
    for LLM calls includes the provider's Authorization header — i.e. API keys end
    up in production logs — and floods the log stream past Railway's rate limit.
    """
    processors = structlog.get_config()["processors"]
    renderer = structlog.dev.ConsoleRenderer(exception_formatter=structlog.dev.plain_traceback)
    structlog.configure(processors=[*processors[:-1], renderer])
