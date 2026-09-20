# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install (from backend/)
pip install -e ".[dev]"

# Run dev server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "<description>"
alembic downgrade -1

# Tests
pytest                                          # all tests
pytest tests/test_auth.py                       # single file
pytest -k "test_register"                       # single test by name
pytest --cov=app --cov-report=term-missing      # coverage

# Lint / type check (if added)
ruff check app/
mypy app/
```

Docker Compose runs postgres + api together from the repo root:
```bash
docker compose up --build
```
API docs at `http://localhost:8000/docs` · Health check: `GET /health`

---

## Architecture

**Request flow:** `Router → Service → Repository → SQLAlchemy model → PostgreSQL`

External compute (quantum simulation, student code) exits the process via `AsyncSandbox.fork()` — FastAPI stays I/O-bound.

### Module map (`app/`)

| Module | Purpose |
|--------|---------|
| `main.py` | FastAPI app factory — registers routers, middleware, exception handler |
| `config.py` | `get_settings()` — Pydantic Settings, all env vars loaded once via `@lru_cache` |
| `database.py` | Async SQLAlchemy engine and session factory |
| `dependencies.py` | FastAPI dependency injectors (DB session, current user, entitlement checks) |
| `exceptions.py` | `QlearnError` hierarchy + global handler; all domain errors raised here |
| `models/` | SQLAlchemy 2.x ORM models — one file per domain (`user`, `learning`, `circuit`, `assessment`, `agent`, `knowledge`, `billing`, `progress`) |
| `schemas/` | Pydantic request/response schemas — **always keep separate from ORM models** |
| `routers/` | Thin route handlers — delegate all logic to services; no business logic here |
| `services/` | Business logic — one service file per domain |
| `agents/` | LangGraph agent definitions — all prompts/configs centralized here |
| `rag/` | RAG pipeline: BM25 + pgvector hybrid, RRF fusion, Cross-Encoder reranker |
| `quantum/` | `QuantumBackend` ABC (`base.py`), `QiskitAerAdapter` (`sandbox_adapter.py`), `QuantumExecutionService` (`execution_service.py`) |
| `core/` | Shared utilities |
| `alembic/` | Migration scripts — **only way** to change the schema |

---

## Key Patterns

### Error handling
Raise from the `QlearnError` hierarchy in `exceptions.py`. The global handler in `main.py` serializes them into `{success, error: {code, message, details}}`. Never raise raw `HTTPException` from services.

```python
from app.exceptions import NotFoundError, PlanRequiredError
raise NotFoundError("Circuit not found")
raise PlanRequiredError("Upgrade to Pro to execute circuits")
```

### Settings
Always import via `get_settings()` — never instantiate `Settings` directly.
```python
from app.config import get_settings
settings = get_settings()
```

### Database sessions
Use the `get_db` dependency — never create sessions manually in route handlers or services.
```python
async def my_route(db: AsyncSession = Depends(get_db)): ...
```

### Quantum execution
Never call Qiskit inside the API process. Go through `QuantumExecutionService` which delegates to `QiskitAerAdapter` → `AsyncSandbox.fork("qlearn-python-base")`. All quantum backends must implement `QuantumBackend` (`app/quantum/base.py`).

### Realtime events
FastAPI publishes to Supabase Realtime channels via the Python SDK. The frontend subscribes via Supabase JS SDK. There are no WebSocket endpoints on the API.

```python
await supabase.realtime.channel(f"circuit:{circuit_id}").send(
    type="broadcast", event="result", payload=result
)
```

### Agent state
LangGraph agents use `AsyncPostgresSaver` as the checkpointer — state persists in PostgreSQL across restarts and API replicas. All agent prompts and graph definitions live in `app/agents/`.

### API response format
All endpoints return:
```json
{ "success": true, "data": { ... } }          // success
{ "success": false, "error": { "code": "...", "message": "...", "details": null } }  // error
```

---

## Database Rules

- **Never** call `Base.metadata.create_all()` — Alembic only
- **Always** use SQLAlchemy 2.x async patterns (`async with session`, `await session.execute(select(...))`)
- ORM models live in `app/models/` — one file per domain group
- `pgvector` column is `Vector(384)` in `knowledge_embeddings`; index type `ivfflat`
- UUID primary keys throughout; `server_default=func.now()` for timestamps

---

## Testing

Tests live in `tests/`. Framework: `pytest` + `pytest-asyncio` (async mode: `auto`).

| Type | What to cover |
|------|--------------|
| Unit | Circuit validation, BKT mastery calculations, schema transformations |
| Integration | API routes + real DB, RAG pipeline, `QiskitAerAdapter` (mock `AsyncSandbox.fork()`) |
| E2E | Full student journey: login → lesson → circuit → execute → quiz → progress |

---

## Environment

Copy `.env.example` → `.env` in `backend/`. Required keys:

| Key | Purpose |
|-----|---------|
| `SECRET_KEY` | JWT signing |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/qlearn` (Docker) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_JWT_SECRET` | Verifies Supabase Auth access tokens (HS256) — required for `/me` and all authed routes |
| `VERCEL_TOKEN` | Sandbox SDK auth |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payment integration |
| `LLM_PRIMARY_MODEL` | LiteLLM model string — default `gpt-4o-mini` |
| `LLM_FALLBACK_MODELS` | JSON list of fallback model strings |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` | Set only for providers you use |

Production env var reference: `../docs/infrastructure.md`

---

## Engineering Rules

1. Plan before coding — understand the change, identify affected modules, consider DB/API/agent implications
2. Routers are thin — all logic belongs in services
3. Schemas ≠ ORM models — never reuse one as the other
4. Centralize agent prompts in `app/agents/` — no scattered prompt strings
5. Quantum backends implement `QuantumBackend`; never use Qiskit directly outside `app/quantum/`
6. No Redis in Phase 0–1 — defer caching until profiling shows a hot path
7. Use `structlog` for structured logging and `AgentTracer` for agent observability
8. Prefer incremental changes — do not rewrite working code
