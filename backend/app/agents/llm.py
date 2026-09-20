from langchain_litellm import ChatLiteLLM
from langchain_core.runnables import Runnable
from app.config import get_settings


def get_llm(temperature: float | None = None) -> Runnable:
    """
    Return a ChatLiteLLM instance wired for smart model routing with fallbacks.

    Primary model is tried first. On rate-limit, auth error, or any provider
    failure, LangChain's .with_fallbacks() tries each fallback in order.

    Model strings follow LiteLLM format:
      - "gpt-4o-mini"                          → OpenAI
      - "anthropic/claude-haiku-4-5-20251001"  → Anthropic
      - "gemini/gemini-1.5-flash"              → Google
      - "ollama/llama3.2"                      → local Ollama
    """
    settings = get_settings()
    temp = temperature if temperature is not None else settings.llm_temperature

    primary = ChatLiteLLM(
        model=settings.llm_primary_model,
        temperature=temp,
        max_tokens=settings.llm_max_tokens,
    )

    if not settings.llm_fallback_models:
        return primary

    fallbacks = [
        ChatLiteLLM(model=model, temperature=temp, max_tokens=settings.llm_max_tokens)
        for model in settings.llm_fallback_models
    ]

    # exceptions_to_handle covers provider errors, rate limits, and auth failures
    return primary.with_fallbacks(
        fallbacks,
        exceptions_to_handle=(Exception,),
    )
