# AGENTS.md — Q-Learn Backend

Guidance for AI coding agents working in `backend/`.

---

## Orientation

FastAPI backend. All computation that is CPU-bound (quantum simulation, student code) exits the process via `AsyncSandbox.fork()`. FastAPI stays I/O-bound. LangGraph agents use `AsyncPostgresSaver` so state survives restarts and multi-replica deployments.

Read `design.md` in this directory before any significant change.

---

## Directory map

```
backend/
├── app/
│   ├── main.py              App factory — registers routers, middleware, exception handler
│   ├── config.py            get_settings() — Pydantic Settings, @lru_cache
│   ├── database.py          Async SQLAlchemy engine + session factory
│   ├── dependencies.py      FastAPI dependency injectors (get_db, get_current_user, entitlement)
│   ├── exceptions.py        QlearnError hierarchy + global handler
│   ├── models/              SQLAlchemy 2.x ORM models (one file per domain)
│   ├── schemas/             Pydantic request/response schemas (separate from ORM)
│   ├── routers/             Route handlers — thin, delegate to services
│   ├── services/            Business logic — one file per domain
│   ├── agents/              LangGraph graphs + ALL prompts centralized here
│   ├── rag/                 RAG pipeline (BM25 + pgvector + RRF + reranker)
│   └── quantum/
│       ├── base.py          QuantumBackend ABC + dataclasses
│       ├── sandbox_adapter.py  QiskitAerAdapter — forks Vercel Sandbox
│       └── execution_service.py  QuantumExecutionService — validates, compiles, executes
├── alembic/                 Migrations — only way to change the schema
└── tests/
```

---

## Non-negotiable rules

| Rule | Consequence of breaking |
|------|------------------------|
| Never import or call Qiskit inside the API process | Blocks the event loop; breaks sandbox isolation |
| Never add WebSocket endpoints | Breaks multi-replica — use Supabase Realtime publish instead |
| Never use `Base.metadata.create_all()` | Schema drift — Alembic is the only migration path |
| Schemas ≠ ORM models | Never return an ORM model directly from a router |
| Routers stay thin | No business logic in route handlers — all logic in services |
| Prompts stay in `app/agents/` | Scattered prompts become unmaintainable and untestable |
| All agent state via `AsyncPostgresSaver` | In-memory state is lost on restart and breaks replicas |
| Raise from `QlearnError` hierarchy | Raw exceptions bypass the global handler and leak internals |

---

## Request flow

```
Router (app/routers/)
  → Service (app/services/)
    → Repository / SQLAlchemy (app/models/)  ← all DB access here
    → QuantumExecutionService (app/quantum/) ← for circuit/code execution
    → AgentOrchestratorService (app/agents/) ← for agent interactions
    → RAGService (app/rag/)                  ← for knowledge retrieval
  → Supabase Realtime publish               ← for async result delivery
```

---

## Adding a new API endpoint

1. Check `docs/api.md` for the route group it belongs to
2. Add Pydantic schemas in `app/schemas/<domain>.py`
3. Add the route handler in `app/routers/<domain>.py` — thin, call service only
4. Add business logic in `app/services/<domain>_service.py`
5. Register router in `app/main.py` with `app.include_router(..., prefix="/api/v1/<domain>")`
6. Write an integration test in `tests/`

Response envelope — all endpoints must return:
```python
return {"success": True, "data": result}          # success
# errors: raise from QlearnError hierarchy — global handler formats them
```

---

## Adding a new agent

1. Read `docs/agents.md` and `app/agents/` existing code first
2. Define the agent as a new LangGraph node with a `TypedDict` state shape
3. Add the node to the graph in the Orchestrator file
4. Add conditional routing from the Orchestrator to the new agent
5. Write all prompts/templates in `app/agents/prompts.py` — never inline in node functions
6. Agent inputs/outputs must be structured (TypedDict, not free-form strings)
7. Agents must not directly query the database — use service/tool interfaces

---

## Adding a new quantum backend

1. Read `docs/quantum-execution.md` and `app/quantum/base.py`
2. Implement all three abstract methods: `validate()`, `compile()`, `execute()`
3. `execute()` must fork `AsyncSandbox` — never run computation in-process
4. Register the new adapter in `QuantumExecutionService._backends`
5. Do not change the `QuantumBackend` ABC without updating all existing adapters

Current gate map (in `sandbox_adapter.py`, `_spec_to_qasm`):
```
H X Y Z S T CX CZ SWAP M
```
Adding a gate requires: update `gate_map` + update `validate()` if it has constraints.

---

## Database changes

Always use Alembic. Never touch the schema directly.

```bash
# After editing a model in app/models/
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Model conventions:
- UUID primary keys everywhere: `id = Column(UUID, primary_key=True, default=uuid4)`
- Timestamps: `server_default=func.now()` for `created_at`, `onupdate=func.now()` for `updated_at`
- JSON columns for flexible data: `Column(JSON, default={})`
- pgvector: `Column(Vector(384))` with `ivfflat` index — only in `knowledge_embeddings`
- Use SQLAlchemy 2.x async patterns throughout (`select(Model).where(...)`, `await session.execute(...)`)

---

## Settings access

Always use the cached singleton. Never instantiate `Settings` directly.

```python
from app.config import get_settings
settings = get_settings()
```

---

## Raising errors

Use the hierarchy in `app/exceptions.py`. The global handler serializes them.

```python
from app.exceptions import NotFoundError, ValidationError, PlanRequiredError, ForbiddenError

raise NotFoundError("Circuit not found")
raise ValidationError("Circuit validation failed", details=errors)
raise PlanRequiredError("Upgrade to Pro to execute circuits")
```

Never raise `HTTPException` from services. Never return error data in a 200 response.

---

## Realtime publish pattern

After completing an async operation, publish via Supabase client — no WebSocket server needed:

```python
from supabase import AsyncClient

# circuit result
await supabase.realtime.channel(f"circuit:{circuit_id}").send(
    type="broadcast", event="result", payload=result_dict
)

# tutor token
await supabase.realtime.channel(f"tutor:{session_id}").send(
    type="broadcast", event="token", payload={"token": token}
)
```

---

## RAG pipeline

Entry point: `RAGService.query(question, session_context)` in `app/rag/`.

Pipeline: query rewriting → BM25 + pgvector (k=12) → RRF fusion → Cross-Encoder reranker (top 5) → LLM synthesis.

Chunk ingestion: `DocumentIngestionService.ingest()` — chunk size 800, overlap 120, embedding dim 384.

The LLM must cite every retrieved source. If no relevant chunks are found, the response must say so — never hallucinate facts.

---

## Testing

```bash
pytest                         # all
pytest tests/test_auth.py      # single file
pytest -k "test_login"         # single test
pytest --cov=app               # with coverage
```

- Mock `AsyncSandbox.fork()` in all tests — never fork real microVMs
- Use `pytest-asyncio` (already configured with `asyncio_mode = "auto"`)
- Integration tests use a real test database (PostgreSQL with pgvector)
- Unit tests: circuit validation, BKT calculations, schema validation — no DB needed

---

## What not to do

- Do not add Redis or Celery (deferred to Phase 2 — only after profiling)
- Do not add in-process LLM streaming that bypasses Supabase Realtime
- Do not add background workers outside of FastAPI `BackgroundTasks` or `AsyncSandbox.fork()`
- Do not add a new dependency without checking if it's already covered by the stack
- Do not create a new service file for a single function — extend the appropriate existing service
- Do not log sensitive data (tokens, passwords, raw user input, LLM responses with PII)
