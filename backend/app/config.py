from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "Q-Learn API"
    debug: bool = False
    secret_key: str
    cors_origins: list[str] = ["http://localhost:3000"]

    # Database
    database_url: str  # postgresql+asyncpg://...

    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str
    # Supabase Auth JWT secret (HS256) — used to verify Supabase-issued access tokens
    supabase_jwt_secret: str = ""

    # JWT
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # LLM — ChatLiteLLM model routing
    # Use LiteLLM model strings: "gpt-4o-mini", "anthropic/claude-haiku-4-5-20251001",
    # "gemini/gemini-1.5-flash", "ollama/llama3.2", etc.
    llm_primary_model: str = "gpt-4o-mini"
    llm_fallback_models: list[str] = ["anthropic/claude-haiku-4-5-20251001", "gemini/gemini-1.5-flash"]
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2048
    llm_model_rpm_limits: dict[str, int] = {}  # LLM_MODEL_RPM_LIMITS — override per-model RPM cap

    # Provider API keys — only set the keys for providers you use
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""          # GROQ_API_KEY
    openrouter_api_key: str = ""    # OPENROUTER_API_KEY

    # Vercel Sandbox
    vercel_token: str = ""
    vercel_team_id: str = ""
    sandbox_base_name: str = "qlearn-python-base"
    sandbox_timeout: int = 30000  # ms

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # Rate limiting
    rate_limit_per_minute: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
