import litellm
import structlog
from langchain_core.messages import BaseMessage
from langchain_core.runnables import Runnable
from langchain_litellm import ChatLiteLLM
from litellm.integrations.custom_logger import CustomLogger

from app.agents.router import ERROR_COOLDOWN_SECONDS, _router
from app.config import get_settings, Settings

logger = structlog.get_logger(__name__)

_META_KEY = "qlearn_router"


def estimate_tokens(messages: list[BaseMessage], max_tokens: int) -> int:
    """Rough upper bound for a request: ~4 chars/token for the prompt plus the full output budget."""
    prompt_chars = sum(len(str(m.content)) for m in messages)
    return prompt_chars // 4 + max_tokens


def _make_llm(model: str, temp: float, settings: Settings, route_meta: dict) -> ChatLiteLLM:
    """Create a ChatLiteLLM tagged with routing metadata the usage callback reads back."""
    kwargs: dict = {
        "model": model,
        "temperature": temp,
        "max_tokens": settings.llm_max_tokens,
        "model_kwargs": {"metadata": {_META_KEY: {**route_meta, "model": model}}},
    }
    if model.startswith("openrouter/"):
        kwargs["extra_headers"] = {
            "HTTP-Referer": "https://qlearn.app",
            "X-Title": "Q-Learn",
        }
    return ChatLiteLLM(**kwargs)


def get_llm(temperature: float | None = None, est_tokens: int | None = None) -> Runnable:
    """
    Return a ChatLiteLLM routed to the model with the most rate-limit headroom
    (RPM, RPD, TPM, TPD) for a request of `est_tokens` tokens. Remaining models
    become ordered fallbacks via .with_fallbacks(). Pass `est_tokens` (see
    estimate_tokens) so token-per-minute limits are respected; it defaults to the
    output budget alone.

    Model strings follow LiteLLM format:
      - "groq/openai/gpt-oss-120b"             → Groq
      - "gemini/gemini-3.8-flash"              → Google
      - "openrouter/openai/gpt-4o"             → OpenRouter
      - "anthropic/claude-haiku-4-5-20251001"  → Anthropic
      - "gpt-4o-mini"                          → OpenAI
      - "ollama/llama3.2"                      → local Ollama
    """
    settings = get_settings()
    temp = temperature if temperature is not None else settings.llm_temperature
    tokens = est_tokens if est_tokens is not None else settings.llm_max_tokens

    _router.configure(settings.llm_model_limits)
    all_models = [settings.llm_primary_model] + (settings.llm_fallback_models or [])
    ordered = _router.get_ordered_models(all_models, tokens)
    _router.record(ordered[0], tokens)

    route_meta = {"reserved_model": ordered[0], "reserved_tokens": tokens}
    primary = _make_llm(ordered[0], temp, settings, route_meta)
    if len(ordered) == 1:
        return primary

    fallbacks = [_make_llm(m, temp, settings, route_meta) for m in ordered[1:]]
    return primary.with_fallbacks(fallbacks, exceptions_to_handle=(Exception,))


def _route_meta(kwargs: dict) -> dict | None:
    metadata = (kwargs.get("litellm_params") or {}).get("metadata") or kwargs.get("metadata") or {}
    return metadata.get(_META_KEY)


def _response_headers(response_obj) -> dict:
    hidden = getattr(response_obj, "_hidden_params", None) or {}
    return hidden.get("additional_headers") or {}


def _total_tokens(response_obj) -> int | None:
    """Tokens that count toward rate limits: total minus cached prompt tokens,
    which Groq doesn't charge."""
    usage = getattr(response_obj, "usage", None)
    total = getattr(usage, "total_tokens", None) if usage is not None else None
    if total is None:
        return None
    cached = getattr(getattr(usage, "prompt_tokens_details", None), "cached_tokens", None) or 0
    return total - cached


class RouterUsageLogger(CustomLogger):
    """Feeds actual per-attempt outcomes back into the router.

    get_llm() reserves estimated capacity on the model it picks; this reconciles
    the reservation with real token usage, charges fallback models that served a
    request, and adopts Groq's rate-limit headers as ground truth.
    """

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        meta = _route_meta(kwargs)
        if not meta:
            return
        model = meta["model"]
        actual = _total_tokens(response_obj)
        if model == meta["reserved_model"]:
            if actual is not None:
                _router.adjust_tokens(model, actual - meta["reserved_tokens"])
        else:
            _router.record(model, actual or 0)
        _router.sync_from_headers(model, _response_headers(response_obj))
        logger.info("llm_routed", model=model, tokens=actual, capacity=_router.snapshot(model))

    def log_failure_event(self, kwargs, response_obj, start_time, end_time):
        meta = _route_meta(kwargs)
        if not meta:
            return
        model = meta["model"]
        if model == meta["reserved_model"]:
            _router.adjust_tokens(model, -meta["reserved_tokens"])
        else:
            _router.record(model)
        exc = kwargs.get("exception")
        if isinstance(exc, litellm.RateLimitError):
            headers = dict(getattr(getattr(exc, "response", None), "headers", None) or {})
            _router.mark_rate_limited(model, headers)
        else:
            _router.mark_unavailable(model, ERROR_COOLDOWN_SECONDS)
        logger.warning("llm_attempt_failed", model=model, error=type(exc).__name__ if exc else None)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        self.log_success_event(kwargs, response_obj, start_time, end_time)

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time):
        self.log_failure_event(kwargs, response_obj, start_time, end_time)


_usage_logger = RouterUsageLogger()
if not any(isinstance(cb, RouterUsageLogger) for cb in litellm.callbacks):
    litellm.callbacks.append(_usage_logger)
