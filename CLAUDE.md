# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Q-Learn is an adaptive multi-agent AI platform for quantum computing education. Three-tier architecture: **Presentation (Vercel/Next.js) → Application (Railway/FastAPI) → Data & Infrastructure (Supabase + Vercel Sandbox)**.

Full architecture: `Architecture.md` · Full product spec: `Project.md` · Dev phases and rules: `Development.md` · Module docs: `docs/`

---

## Commands

### Full stack (Docker Compose — preferred for development)
```bash
docker compose up --build        # starts postgres, api, web
docker compose up --no-build     # restart without rebuild
```

### Backend (FastAPI)
```bash
cd backend

# Install
pip install -e ".[dev]"

# Run (dev)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "<description>"
alembic downgrade -1

# Tests
pytest                            # all tests
pytest tests/test_auth.py         # single file
pytest -k "test_name"             # single test
pytest --cov=app --cov-report=term-missing
```

### Frontend (Next.js)
```bash
cd frontend

# Install
pnpm install

# Dev server
pnpm dev                          # http://localhost:3000

# Type check + lint
pnpm type-check
pnpm lint

# Build
pnpm build
```

---

## Architecture

### Backend (`backend/app/`)

Pattern: **Router → Service → Repository → SQLAlchemy model → PostgreSQL**

| Path | Purpose |
|------|---------|
| `main.py` | FastAPI app factory — registers routers, middleware, exception handlers |
| `config.py` | `get_settings()` — Pydantic Settings, all env vars |
| `database.py` | Async SQLAlchemy engine and session factory |
| `dependencies.py` | FastAPI dependency injectors (DB session, current user, entitlement checks) |
| `exceptions.py` | `QlearnError` base + global handler |
| `models/` | SQLAlchemy 2.x ORM models — always use Alembic to migrate |
| `schemas/` | Pydantic request/response schemas — **keep separate from ORM models** |
| `routers/` | Thin route handlers — delegate all logic to services |
| `services/` | Business logic |
| `agents/` | LangGraph agent definitions — centralize all prompts/configs here |
| `rag/` | RAG pipeline (BM25 + pgvector + RRF + Cross-Encoder reranker) |
| `quantum/` | `QiskitAerAdapter` and `QuantumBackend` interface — never import Qiskit directly in services |
| `core/` | Shared utilities |

**Critical rules:**
- Never run Qiskit or student code inside the API process — always fork `AsyncSandbox`
- Never use `Base.metadata.create_all()` in production — Alembic only
- Use SQLAlchemy 2.x async patterns throughout
- Agent prompts/config must not be scattered — centralize in `agents/`
- Realtime events flow via Supabase pub/sub; FastAPI publishes, frontend subscribes
- LangGraph state persists via `AsyncPostgresSaver` (agent sessions survive restarts)

### Frontend (`frontend/src/`)

VS Code-style IDE shell with 6 zones and 6 workspace modes.

| Path | Purpose |
|------|---------|
| `app/` | Next.js 14 App Router pages — `auth/`, `dashboard/`, `learn/`, `circuit/`, `quiz/`, `pricing/`, `settings/` |
| `components/` | Feature components — `circuit/` (React Flow builder), `tutor/` (AI panel), `visualization/`, `billing/`, `ui/` |
| `stores/` | Zustand stores — `authStore`, `learningStore`, `circuitStore`, `tutorStore`, `quizStore`, `billingStore`, `shellStore` |
| `hooks/` | Custom React hooks |
| `lib/` | Supabase client, API client, utilities |
| `types/` | TypeScript type definitions |

**Critical rules:**
- Subscribe to Supabase Realtime for circuit results, tutor tokens, and progress updates — do not poll
- Circuit builder uses `@xyflow/react` (React Flow) with custom gate nodes
- All state lives in Zustand stores; avoid prop-drilling

### Key external boundaries

| Boundary | Detail |
|----------|--------|
| Vercel Sandbox | `AsyncSandbox.fork("qlearn-python-base")` — isolated microVM, deny-all network, 512 MB RAM, 30s timeout |
| Supabase Realtime | FastAPI publishes events; frontend subscribes via `@supabase/supabase-js` |
| LLM provider | Abstracted — supports GPT / Claude / Gemini / Ollama; never hardcode a provider |
| Razorpay | Freemium + Pro subscriptions; AI Tutor + circuit execution gated behind Pro |
| pgvector | dim=384 embeddings in `knowledge_embeddings` table |

---

## Development Rules (from `Development.md`)

1. **Plan before coding** — understand → inspect → identify dependencies → plan → implement → test → review
2. Do not rewrite working code without reason; prefer incremental changes
3. Wait for approval before major architectural changes
4. Keep API schemas separate from ORM models
5. Centralize agent definitions, prompts, and configuration — do not scatter across files
6. Use SQLAlchemy 2.x async; migrate via Alembic only
7. Quantum backends must implement the `QuantumBackend` interface
8. Keep agents specialized — one clear responsibility, structured inputs/outputs
9. Use structured logging (`structlog`) and agent tracing for observability

---

## Testing

- Unit tests: circuit validation, BKT calculations, service endpoints (mocked dependencies)
- Integration tests: API + PostgreSQL, RAG pipeline, `QiskitAerAdapter` (mock `AsyncSandbox.fork()`)
- E2E: full student journey (login → lesson → circuit → execute → quiz → evaluation → progress)

See `docs/quantum-execution.md`, `docs/rag-pipeline.md`, `docs/agents.md`, `docs/sandbox.md` for the boundaries each test type covers.

---

## Environment

Copy `.env.example` → `.env` (root), `backend/.env`, `frontend/.env.local`. Required variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`, `VERCEL_TOKEN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `LLM_PROVIDER`. Full reference: `docs/infrastructure.md`.

Local dev database: `postgresql+asyncpg://postgres:postgres@localhost:5432/qlearn` (Docker Compose).
