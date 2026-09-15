# Q-Learn Backend

FastAPI backend for the Q-Learn adaptive quantum computing education platform.

**Stack:** Python 3.11 · FastAPI · SQLAlchemy 2.x · Alembic · LangGraph · LlamaIndex · pgvector · Vercel Sandbox

---

## Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose v2+ (recommended for development)
- Supabase project (Auth, PostgreSQL + pgvector, Realtime)
- Vercel account (Hobby plan — for Sandbox)

### With Docker Compose (recommended)

From the **repo root**:

```bash
cp .env.example .env          # fill in all variables
docker compose up --build
```

- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### Local (without Docker)

```bash
cd backend
pip install -e ".[dev]"
cp .env.example .env          # fill in variables

alembic upgrade head           # apply migrations

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Requires a running PostgreSQL instance with the pgvector extension enabled. See `../docs/infrastructure.md` for the full environment variable reference.

---

## Project Structure

```
backend/
├── app/
│   ├── main.py              # App factory — routers, middleware, exception handler
│   ├── config.py            # Pydantic Settings (get_settings)
│   ├── database.py          # Async SQLAlchemy engine and session
│   ├── dependencies.py      # FastAPI dependency injectors
│   ├── exceptions.py        # QlearnError hierarchy + global handler
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── routers/             # Route handlers (thin — delegate to services)
│   ├── services/            # Business logic
│   ├── agents/              # LangGraph agent graphs + centralized prompts
│   ├── rag/                 # RAG pipeline (BM25 + pgvector + reranker)
│   ├── quantum/             # QuantumBackend interface + QiskitAerAdapter
│   └── core/                # Shared utilities
├── alembic/                 # Migration scripts
├── tests/
├── Dockerfile
└── pyproject.toml
```

---

## Architecture

### Request flow

```
HTTP Request → FastAPI Router → Service → Repository → PostgreSQL
                                    ↓
                           Vercel Sandbox (quantum / student code)
                           Supabase Realtime (result pub/sub)
                           LLM Provider (RAG / agents)
```

### Key design decisions

**No in-process Qiskit.** All quantum simulation and student code execution runs inside a Vercel Sandbox microVM via `AsyncSandbox.fork("qlearn-python-base")`. FastAPI remains I/O-bound under concurrent load.

**No WebSocket endpoints.** Real-time events (circuit results, tutor tokens, progress updates) flow through Supabase Realtime pub/sub. FastAPI publishes; the frontend subscribes via the Supabase JS SDK. This eliminates the multi-replica sticky-session problem.

**Agent state in PostgreSQL.** LangGraph uses `AsyncPostgresSaver` as its checkpointer. Agent sessions survive API restarts and work across replicas.

**No Redis in Phase 0–1.** Deferred until profiling identifies a specific hot path.

---

## API

Base path: `/api/v1/`

| Group | Prefix | Implemented |
|-------|--------|-------------|
| Auth | `/auth` | Phase 0 |
| Billing | `/billing` | Phase 0 |
| Users | `/users` | Phase 1 |
| Courses / Lessons | `/courses`, `/modules`, `/lessons` | Phase 1 |
| Learning | `/learning` | Phase 1 |
| Circuits | `/circuits` | Phase 1 |
| Simulations | `/simulations` | Phase 1 |
| Quizzes | `/quizzes` | Phase 1 |
| Coding Challenges | `/challenges` | Phase 2 |
| AI Agents | `/agents` | Phase 2 |
| Knowledge / RAG | `/knowledge` | Phase 1–2 |
| Analytics | `/analytics` | Phase 2 |
| Instructor | `/instructor` | Phase 2 |
| Admin | `/admin` | Phase 2 |

All responses follow a consistent envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": null } }
```

Full route reference: `design.md` → API Routes Reference.

---

## Authentication

JWT-based. Access tokens expire in 15 minutes; refresh tokens in 7 days (HttpOnly cookie). Tokens carry `user_id`, `role`, and `permissions`.

**Roles:** `student` · `instructor` · `admin`

Supabase Auth handles the identity layer in production. The `dependencies.py` module provides FastAPI dependency injectors for `get_current_user` and role/entitlement checks.

---

## Quantum Execution

All quantum backends implement `QuantumBackend` (`app/quantum/base.py`):

```
QuantumBackend
├── QiskitAerAdapter   (Phase 0 — via Vercel Sandbox)
├── PennyLaneAdapter   (Phase 2)
└── CirqAdapter        (Phase 2)
```

`QiskitAerAdapter.execute()` serializes the circuit to a self-contained Python script, forks a Vercel Sandbox microVM, runs Qiskit Aer, and deserializes the JSON result. The API never imports Qiskit.

**Sandbox constraints:** deny-all network, 512 MB RAM, 30-second timeout, Qiskit pre-installed via `qlearn-python-base` snapshot.

---

## RAG Pipeline

```
User query → Query rewriting → BM25 (sparse) + pgvector (dense) → RRF fusion
           → Cross-Encoder reranking (top 5) → LLM synthesis → grounded response
```

Embeddings: `sentence-transformers/all-MiniLM-L6-v2` · dim=384 · stored in `knowledge_embeddings` (pgvector `ivfflat` index).

Document ingestion: chunk size 800 tokens, overlap 120 tokens.

---

## AI Agents

LangGraph multi-agent graph with `AsyncPostgresSaver` checkpointing:

| Agent | Responsibility |
|-------|---------------|
| **Orchestrator** | Routes requests to the appropriate specialist agent |
| **Tutor** | Adaptive explanations grounded in RAG |
| **Circuit Agent** | Circuit validation, analysis, "Explain My Circuit" |
| **Evaluation** | Quiz scoring, feedback generation |
| **Recommendation** | Learning path and next-activity suggestions |
| **Research** | Citation-backed answers from the knowledge base |

All prompts and graph definitions are centralized in `app/agents/`.

---

## Database

PostgreSQL 16 + pgvector. Schema managed exclusively via Alembic migrations.

Core entity groups:
- `users` / `user_profiles`
- `courses` / `modules` / `lessons` / `concepts`
- `learning_progress` / `skill_mastery` (BKT — mastery score 0.0–1.0)
- `circuits` / `circuit_executions`
- `quizzes` / `quiz_questions` / `quiz_attempts`
- `coding_challenges` / `challenge_attempts`
- `agent_sessions` / `agent_messages`
- `knowledge_documents` / `document_chunks` / `knowledge_embeddings`

Full ERD and migration strategy: `../docs/database.md`

```bash
# Create a new migration after changing a model
alembic revision --autogenerate -m "add skill_mastery table"

# Apply
alembic upgrade head

# Roll back one
alembic downgrade -1
```

---

## Testing

```bash
pytest                                         # all tests
pytest tests/test_auth.py                      # single file
pytest -k "test_register"                      # single test
pytest --cov=app --cov-report=term-missing     # with coverage
```

**Unit tests** — circuit validation, BKT calculations, schema transforms  
**Integration tests** — API + PostgreSQL, RAG pipeline, `QiskitAerAdapter` (mock `AsyncSandbox.fork()`)  
**E2E** — full student journey: login → lesson → circuit → execute → quiz → progress

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT signing key |
| `DATABASE_URL` | Yes | `postgresql+asyncpg://...` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VERCEL_TOKEN` | Yes | Vercel API token (Sandbox) |
| `RAZORPAY_KEY_ID` | Yes | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay key secret |
| `LLM_PROVIDER` | No | `ollama` (default) \| `openai` \| `anthropic` \| `gemini` |
| `OPENAI_API_KEY` | If using OpenAI | — |
| `ANTHROPIC_API_KEY` | If using Anthropic | — |

Full reference: `../docs/infrastructure.md`

---

## Deployment

The FastAPI service runs in a Docker container and is deployed to **Railway** (Free → paid). Architecture is portable — move to Fly.io or any VPS without redesigning Q-Learn.

Production services:

| Service | Platform |
|---------|----------|
| FastAPI API | Railway |
| PostgreSQL + pgvector + Auth + Realtime | Supabase Cloud |
| Frontend | Vercel |
| Quantum + Student code execution | Vercel Sandbox (Hobby) |
| CI/CD | GitHub Actions |

---

## Documentation

| Document | Contents |
|----------|----------|
| `design.md` | Full backend implementation detail — API routes, service patterns, DB schema, agent code |
| `../Architecture.md` | System diagram and platform overview |
| `../docs/agents.md` | LangGraph topology and AsyncPostgresSaver |
| `../docs/quantum-execution.md` | QiskitAerAdapter and Sandbox fork sequence |
| `../docs/rag-pipeline.md` | Hybrid retrieval and reranking detail |
| `../docs/database.md` | ERD, key tables, migration strategy |
| `../docs/security.md` | Auth flow, RBAC, security controls |
| `../docs/infrastructure.md` | Production stack and env var reference |
