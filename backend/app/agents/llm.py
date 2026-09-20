from langchain_litellm import ChatLiteLLM
from langchain_core.runnables import Runnable
from app.config import get_settings, Settings


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
    Return a ChatLiteLLM instance wired for smart model routing with fallbacks.

    Primary model is tried first. On rate-limit, auth error, or any provider
    failure, LangChain's .with_fallbacks() tries each fallback in order.

    Model strings follow LiteLLM format:
      - "gpt-4o-mini"                          → OpenAI
      - "anthropic/claude-haiku-4-5-20251001"  → Anthropic
      - "gemini/gemini-1.5-flash"              → Google
      - "groq/llama3-8b-8192"                  → Groq
      - "openrouter/openai/gpt-4o"             → OpenRouter
      - "ollama/llama3.2"                      → local Ollama
    """
    settings = get_settings()
    temp = temperature if temperature is not None else settings.llm_temperature

    primary = _make_llm(settings.llm_primary_model, temp, settings)

    if not settings.llm_fallback_models:
        return primary

    fallbacks = [
        _make_llm(model, temp, settings)
        for model in settings.llm_fallback_models
    ]

    # exceptions_to_handle covers provider errors, rate limits, and auth failures
    return primary.with_fallbacks(
        fallbacks,
        exceptions_to_handle=(Exception,),
    )
