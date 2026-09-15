# AGENTS.md — Q-Learn

Guidance for AI coding agents working in this repository.

---

## What this project is

Q-Learn is an **adaptive quantum computing education platform** with a multi-agent AI core. It is a startup product (SIH2614 origin, now production-quality). The learning loop is:

```
LEARN → BUILD → SIMULATE → OBSERVE → EXPLAIN → PRACTICE → EVALUATE → ADAPT
```

Three-tier architecture: **Next.js (Vercel) → FastAPI (Railway) → Supabase + Vercel Sandbox**

---

## Repository layout

```
Q-Learn/
├── frontend/          Next.js 14 App Router — IDE shell, React Flow circuit builder, Zustand stores
├── backend/           FastAPI — services, LangGraph agents, RAG, quantum adapters
├── docs/              Architecture module docs (agents, rag-pipeline, quantum-execution, etc.)
├── Architecture.md    System diagram + engineering rules
├── Development.md     Dev phases, code rules, testing strategy, Claude Code operating rules
├── Project.md         Full product spec
└── docker-compose.yml Development stack (postgres + api + web)
```

Read `Architecture.md` and `Development.md` before any cross-cutting change.

---

## Before you touch any code

1. **Read the relevant doc first.** Each module has a doc: `docs/agents.md`, `docs/rag-pipeline.md`, `docs/quantum-execution.md`, `docs/sandbox.md`, `docs/security.md`, `docs/database.md`. Read it before editing that module.
2. **Plan before implementing.** Understand what changes, why, which files/modules are affected, DB/API/agent implications, test plan, risks. Do not start coding immediately.
3. **Prefer incremental changes.** Do not rewrite working code. Do not restructure a module unless the task explicitly requires it.
4. **Inspect the repo.** Check what already exists before creating new files.

---

## Platform-level invariants — never violate these

| Rule | Why |
|------|-----|
| Never run Qiskit or student Python inside the FastAPI process | CPU-bound work blocks the async event loop; microVM isolation is a security requirement |
| Never add WebSocket endpoints to FastAPI | Real-time events flow via Supabase Realtime pub/sub; a FastAPI ws:// endpoint breaks multi-replica deployments |
| Never call `Base.metadata.create_all()` in production | Schema is managed exclusively by Alembic migrations |
| Never expose LLM API keys to the frontend | All LLM calls are proxied through the backend |
| Never let the LLM directly control infrastructure | LLM output must go through validation + service boundaries before any execution |
| Never scatter agent prompts across files | All prompts and agent definitions live in `backend/app/agents/` |
| Agent state must persist in PostgreSQL | Use `AsyncPostgresSaver` — in-memory state breaks multi-replica and restart recovery |
| AI-generated circuits must be validated before execution | Run `QuantumBackend.validate()` before `compile()` and `execute()` |

---

## The Q-Learn AI agent system (built into the product)

This is the multi-agent system students interact with — not the coding agent reading this file.

### Agent topology (LangGraph, `backend/app/agents/`)

```
Orchestrator
├── Tutor Agent          — adaptive explanation, confusion detection, teaching progression
├── Circuit Agent        — generation, validation, explanation, error detection
├── Quiz Agent           — dynamic question generation, adaptive difficulty
├── Evaluation Agent     — answer/circuit/code scoring, BKT mastery updates
├── Recommendation Agent — mastery analysis, weak concept ID, next activity
└── Research Agent       — RAG retrieval, citations, source validation
```

Each agent has **one clear responsibility**. Do not merge responsibilities between agents. Do not route directly between specialist agents — everything goes through the Orchestrator.

### Shared tool layer (all agents can use)

| Tool | Purpose |
|------|---------|
| RAG Retrieval | Search the knowledge base (`backend/app/rag/`) |
| Quantum Exec | Execute circuits via `QuantumExecutionService` |
| Code Sandbox | Run student Python via `AsyncSandbox.fork()` |
| Learning Data | Read/write `skill_mastery`, `learning_progress`, `agent_sessions` |

### State persistence

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
app = workflow.compile(checkpointer=checkpointer)
```

State is checkpointed to `agent_sessions` / `agent_messages` tables after every graph step.

### Communication flow

```
Student input → Orchestrator (load profile + checkpoint)
              → delegate to specialist agent
              → Evaluation Agent (BKT update)
              → Recommendation Agent (next activity)
              → checkpoint + return response
```

---

## RAG pipeline (`backend/app/rag/`)

```
Query → rewrite (+ lesson context) → BM25 (sparse) + pgvector k=12 (dense)
      → RRF fusion → Cross-Encoder reranker top-5 → LLM synthesis → answer + citations
```

| Parameter | Value |
|-----------|-------|
| Embedding model | `sentence-transformers/all-MiniLM-L6-v2` dim=384 |
| Chunk size / overlap | 800 tokens / 120 tokens |
| Vector store | pgvector — `knowledge_embeddings` table, `ivfflat` index |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` |

Every answer must cite sources. If no relevant chunks are found, say so explicitly — do not hallucinate.

---

## Quantum execution layer (`backend/app/quantum/`)

```
CircuitSpec → QuantumExecutionService.execute()
           → backend.validate()    [raises ValidationError on failure]
           → backend.compile()     [→ CompiledCircuit with QASM]
           → backend.execute()     [→ AsyncSandbox.fork() → JSON result]
           → store in circuit_executions
           → publish to Supabase Realtime circuit:{id}
```

All quantum backends implement `QuantumBackend` (`base.py`). Current: `QiskitAerAdapter`. Phase 2: `PennyLaneAdapter`, `CirqAdapter`. Never add a new backend by modifying the adapter — implement the interface.

**LLM never replaces deterministic quantum computation.** The simulator is the source of truth for all results.

---

## Real-time architecture

```
FastAPI completes work
  → supabase.realtime.channel("{scope}:{id}").send(event, payload)

Frontend subscribes:
  → supabase.channel("{scope}:{id}").on("broadcast", ...).subscribe()
```

| Channel pattern | Event | Consumer |
|----------------|-------|----------|
| `circuit:{circuitId}` | `result` | CircuitCanvas |
| `tutor:{sessionId}` | `token` | AITutorPanel |
| `progress:{userId}` | `mastery` | Dashboard |

---

## Data flow reference (7 flows)

| # | From → To | Transport |
|---|-----------|-----------|
| 1 | Frontend → FastAPI | HTTPS REST |
| 2 | FastAPI → Vercel Sandbox (circuit) | `AsyncSandbox.fork()` |
| 3 | FastAPI → Vercel Sandbox (student code) | `AsyncSandbox.fork()` |
| 4 | FastAPI → Supabase Realtime (publish) | Supabase Python SDK |
| 5 | Supabase Realtime → Frontend (subscribe) | Supabase JS SDK WebSocket |
| 6 | FastAPI → LLM Provider | HTTPS |
| 7 | LLM tokens → Frontend | LLM → FastAPI → Realtime → Frontend |

---

## Common tasks — where to look

| Task | Files to read first | Files to change |
|------|--------------------|--------------------|
| Add a new API endpoint | `backend/app/routers/`, `docs/api.md` | new router + service + schema |
| Add a new agent | `docs/agents.md`, `backend/app/agents/` | new node in graph, add to Orchestrator routing |
| Add a new quantum gate | `docs/quantum-execution.md`, `backend/app/quantum/sandbox_adapter.py` | `_spec_to_qasm`, gate_map, frontend `GatePalette` + `GateNode` |
| Add a new workspace mode | `frontend/design.md`, `frontend/src/stores/shellStore.ts` | `Workspace` type, ActivityBar icon, lazy workspace component |
| Change DB schema | `docs/database.md`, `backend/app/models/` | model file + `alembic revision --autogenerate` |
| Add RAG document type | `docs/rag-pipeline.md`, `backend/app/rag/` | ingestion pipeline + metadata schema |
| Change Pro gating | `docs/payment-system-design.md`, `backend/app/exceptions.py` | `PlanRequiredError` raise site + frontend upgrade modal trigger |

---

## Security rules for agents

- Do not log sensitive data (tokens, passwords, PII)
- Do not hardcode API keys, secrets, or environment-specific values
- Do not add `Base.metadata.create_all()` anywhere
- Do not write SQL strings — use SQLAlchemy parameterized queries
- Do not expose backend errors verbatim to API responses — use the `QlearnError` hierarchy
- Do not allow student-supplied content to reach LLM system prompts without sanitization
- Rate limiting (slowapi) must remain on all public endpoints

---

## Testing expectations

| Type | Required for |
|------|-------------|
| Unit | Circuit validation logic, BKT calculations, schema transforms |
| Integration | API routes + DB, RAG retrieval, `QiskitAerAdapter` (mock `AsyncSandbox.fork()`) |
| E2E | Full student journey: login → lesson → circuit → execute → quiz → progress |

Mock `AsyncSandbox.fork()` in all integration tests — never fork real microVMs in CI.
