from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

_LLM_LIMIT_KEYS = {"rpm", "rpd", "tpm", "tpd"}


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

    # LLM — ChatLiteLLM model routing (see docs/llm-model-router.md)
    # Use LiteLLM model strings: "groq/openai/gpt-oss-120b", "anthropic/claude-haiku-4-5-20251001",
    # "ollama/llama3.2", etc.
    llm_primary_model: str = "groq/openai/gpt-oss-120b"
    llm_fallback_models: list[str] = ["groq/openai/gpt-oss-20b", "groq/qwen/qwen3.8-27b"]
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2048
    # LLM_MODEL_LIMITS — per-model overrides of any of rpm/rpd/tpm/tpd, e.g. after a
    # paid-tier upgrade: {"groq/openai/gpt-oss-120b": {"rpm": 1000, "tpm": 250000}}
    llm_model_limits: dict[str, dict[str, int]] = {}

    @field_validator("llm_model_limits")
    @classmethod
    def _check_llm_limit_keys(cls, value: dict[str, dict[str, int]]) -> dict[str, dict[str, int]]:
        for model, limits in value.items():
            unknown = set(limits) - _LLM_LIMIT_KEYS
            if unknown:
                raise ValueError(
                    f"LLM_MODEL_LIMITS[{model!r}] has unknown keys {sorted(unknown)}; "
                    f"allowed: {sorted(_LLM_LIMIT_KEYS)}"
                )
        return value

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
    sandbox_memory: int = 2048  # MB — Vercel Sandbox minimum
    sandbox_timeout: int = 30000  # ms

    # Rate limiting
    rate_limit_per_minute: int = 100

    # Payload CMS (cms/) — shared secret the CMS sends as X-CMS-Secret when it
    # registers published content in content_refs. Empty disables the endpoint.
    cms_webhook_secret: str = ""

    # RAG — chunk width in words. Must stay <= embeddings.MAX_WORDS_PER_CHUNK so
    # the embedder sees the whole chunk (see app/rag/embeddings.py).
    rag_chunk_words: int = 200
    rag_chunk_overlap: int = 40


@lru_cache
def get_settings() -> Settings:
    return Settings()
