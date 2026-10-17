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

    # LangGraph checkpointer (AI Classroom). psycopg needs a direct or session-mode
    # connection (NOT the :6543 transaction pooler). Plain libpq URL, e.g.
    # postgresql://user:pass@host:5432/db. Empty = derive from DATABASE_URL when it
    # is not on the pooler; otherwise the classroom runs without a checkpointer.
    checkpoint_database_url: str = ""

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

    # AI Classroom — slowapi limits (applied to /api/v1/classroom routes only)
    classroom_rate_limit_turns: str = "20/minute"
    classroom_rate_limit_sessions: str = "10/minute"
    classroom_rate_limit_reads: str = "120/minute"
    # Seconds a run may go without writing an event before its lease is stale.
    classroom_run_lease_seconds: int = 120

    # Payload CMS (cms/) — shared secret the CMS sends as X-CMS-Secret when it
    # registers published content in content_refs. Empty disables the endpoint.
    cms_webhook_secret: str = ""

    # RAG — chunk width in words. Must stay <= embeddings.MAX_WORDS_PER_CHUNK so
    # the embedder sees the whole chunk (see app/rag/embeddings.py).
    rag_chunk_words: int = 200
    rag_chunk_overlap: int = 40
    # Retrieval — chunks returned to the tutor, candidates per arm (dense, FTS)
    # fused with RRF, and the dense cosine-similarity floors a candidate must
    # clear: rag_min_score in general, rag_min_score_fts when the full-text arm
    # matched it too. Calibrated with scripts/rag_eval.py (docs/rag-pipeline.md).
    rag_top_k: int = 4
    rag_candidate_k: int = 20
    rag_min_score: float = 0.30
    rag_min_score_fts: float = 0.20
    # Load the embedding model at startup instead of on the first tutor turn.
    rag_warmup_embeddings: bool = True

    # Sentry — error monitoring + tracing. Empty DSN disables the SDK entirely
    # (local dev, tests). See docs/observability.md.
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    # Fraction of requests to trace (0.0-1.0). Keep conservative in production;
    # tune via the host env var (InstaCloud secret), not by editing this default.
    sentry_traces_sample_rate: float = 0.05
    # Profiling piggybacks on traced transactions and adds real overhead — off
    # by default, opt in per-environment.
    sentry_profiles_sample_rate: float = 0.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
