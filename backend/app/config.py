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
    # Auth: VERCEL_TOKEN (+ optional VERCEL_TEAM_ID / VERCEL_PROJECT_ID) — read by
    # the SDK via the environment; also surfaced here for explicit passing.
    vercel_token: str = ""
    vercel_team_id: str = ""
    vercel_project_id: str = ""
    # Qiskit-ready runtime. Set exactly one of these so forks start warm (no
    # per-run `pip install`):
    #   - sandbox_snapshot_id: restore from a snapshot that has qiskit/qiskit-aer
    #   - sandbox_image:       a custom OCI image with qiskit/qiskit-aer preinstalled
    # If both are empty the runner falls back to the default image (dev only —
    # the script will fail unless qiskit is otherwise available).
    sandbox_snapshot_id: str = ""
    sandbox_image: str = ""
    sandbox_vcpus: int = 1
    sandbox_memory: int = 512  # MB
    sandbox_timeout: int = 30000  # ms

    # Rate limiting
    rate_limit_per_minute: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
