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

    # JWT
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # LLM
    llm_provider: str = "ollama"  # ollama | openai | anthropic | gemini
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

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
