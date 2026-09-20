from langchain_litellm import ChatLiteLLM
from langchain_core.runnables import Runnable
from app.config import get_settings, Settings
from app.agents.router import _router


def _make_llm(model: str, temp: float, settings: Settings) -> ChatLiteLLM:
    """Create a ChatLiteLLM instance with optional OpenRouter extra headers."""
    kwargs: dict = {
        "model": model,
        "temperature": temp,
        "max_tokens": settings.llm_max_tokens,
    }
    if model.startswith("openrouter/"):
        kwargs["extra_headers"] = {
            "HTTP-Referer": "https://qlearn.app",
            "X-Title": "Q-Learn",
        }
    return ChatLiteLLM(**kwargs)


def get_llm(temperature: float | None = None) -> Runnable:
    """
    Return a ChatLiteLLM instance routed to the model with the most remaining
    RPM headroom. Remaining models become ordered fallbacks via .with_fallbacks().

    Model strings follow LiteLLM format:
      - "gpt-4o-mini"                          → OpenAI
      - "anthropic/claude-haiku-4-5-20251001"  → Anthropic
      - "gemini/gemini-2.0-flash"              → Google
      - "groq/llama-3.3-70b-versatile"         → Groq
      - "openrouter/openai/gpt-4o"             → OpenRouter
      - "ollama/llama3.2"                      → local Ollama
    """
    settings = get_settings()
    temp = temperature if temperature is not None else settings.llm_temperature

    all_models = [settings.llm_primary_model] + (settings.llm_fallback_models or [])
    ordered = _router.get_ordered_models(all_models, settings.llm_model_rpm_limits or None)
    _router.record(ordered[0])

    primary = _make_llm(ordered[0], temp, settings)
    if len(ordered) == 1:
        return primary

    fallbacks = [_make_llm(m, temp, settings) for m in ordered[1:]]
    return primary.with_fallbacks(fallbacks, exceptions_to_handle=(Exception,))
