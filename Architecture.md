# Q-Learn — Architecture Documentation

## Overview

Q-Learn is an AI-powered adaptive learning platform for quantum computing. Three-tier architecture: Presentation (Vercel/Next.js) → Application (Railway/FastAPI) → Data & Infrastructure (Supabase + Vercel Sandbox + LLM).

**Visual diagrams:**
- [`assets/architecture-high-level.svg`](assets/architecture-high-level.svg) — platform topology
- [`assets/architecture-low-level.svg`](assets/architecture-low-level.svg) — internal FastAPI layers, execution paths, agent graph, RAG, DB schema

**Design documents (full implementation detail):**
- [`frontend/design.md`](frontend/design.md) — marketing landing page, IDE shell, workspaces, component tree, Zustand stores, Circuit Builder, AI Tutor panel
- [`backend/design.md`](backend/design.md) — API routes, SQLAlchemy models, service layer, auth, error handling, deployment

**Module docs (`docs/`):**
- [`docs/frontend-layer.md`](docs/frontend-layer.md) — shell zones, workspace layouts, Zustand stores, design system
- [`docs/data-flow.md`](docs/data-flow.md) — all 7 platform flows (REST, Sandbox, Realtime, LLM)
- [`docs/database.md`](docs/database.md) — ERD, key tables, migration strategy
- [`docs/quantum-execution.md`](docs/quantum-execution.md) — adapter pattern, Vercel Sandbox fork, execution sequence
- [`docs/rag-pipeline.md`](docs/rag-pipeline.md) — ingestion, hybrid retrieval, reranking, knowledge base
- [`docs/sandbox.md`](docs/sandbox.md) — microVM architecture, circuit simulation and student code flows
- [`docs/agents.md`](docs/agents.md) — agent topology, responsibilities, LangGraph + AsyncPostgresSaver
- [`docs/llm-model-router.md`](docs/llm-model-router.md) — ModelRouter design, capacity pool, refilling-bucket algorithm, shared context
- [`docs/security.md`](docs/security.md) — security diagram, controls table, auth flow, RBAC
- [`docs/api.md`](docs/api.md) — API groups, response format, design rules
- [`docs/infrastructure.md`](docs/infrastructure.md) — production stack, Docker Compose, env vars, deployment

---

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Low-Level Architecture](#low-level-architecture)
- [LLM Model Routing](#llm-model-routing)
- [Engineering Rules](#engineering-rules)
- [Product Principle](#product-principle)

---

## High-Level Architecture

Three-tier architecture: Presentation Layer → Application Layer → Data & Infrastructure Layer.

```mermaid
flowchart TD
    subgraph PRESENTATION["🖥️ PRESENTATION LAYER — Vercel (Next.js + React)"]
        direction LR
        Home["Marketing Home\n(public, unauthenticated)"]
        Auth["Auth Pages"]
        Dashboard["Student Dashboard"]
        CircuitUI["Circuit Builder\n(React Flow)"]
        Quiz["Quiz & Challenges"]
        Lesson["Lesson Reader"]
        Sim["Simulation &\nVisualization"]
        Instructor["Instructor /\nAdmin"]
    end

    subgraph APPLICATION["⚙️ APPLICATION LAYER — Railway (FastAPI + Python)"]
        direction TB
        GW["API Gateway\nVerify Supabase JWT • Rate Limit • Validation • Routing • Logging"]

        subgraph SERVICES["Services"]
            direction LR
            AuthSvc["Auth\nService"]
            LearnSvc["Learning\nService"]
            CircuitSvc["Circuit\nService"]
            AssessSvc["Assessment\nService"]
            QuantumSvc["Quantum\nExecution"]
            AgentSvc["AI / Agent\nService"]
            RAGSvc["RAG\nService"]
            RecSvc["Recommendation\nService"]
            Analytics["Analytics\nService"]
        end

        GW --> SERVICES
    end

    subgraph DATA["🗄️ DATA & INFRASTRUCTURE LAYER"]
        direction LR
        subgraph Supabase["Supabase"]
            DB["PostgreSQL\n+ pgvector"]
            SupaAuth["Auth"]
            Storage["Storage"]
            Realtime["Realtime\n(WebSocket pub/sub)"]
        end

        subgraph VercelSandbox["Vercel Sandbox (Hobby)"]
            MicroVM["Isolated microVM\nQiskit image/snapshot\nQiskit Aer + Student Python"]
        end

        subgraph External["External"]
            LLM["LLM Pool (3 Groq models)\nModelRouter → ChatLiteLLM\nRPM · RPD · TPM · TPD aware"]
            KnowledgeBase["Knowledge Sources\nDocs • Papers • Course Material"]
        end
    end

    PRESENTATION -- "HTTPS / REST\n(Authorization: Bearer <Supabase JWT>)" --> APPLICATION
    Auth -- "Supabase Auth SDK\n(email/password · Google OAuth)" --> SupaAuth
    APPLICATION -- "Supabase Realtime pub/sub\n(circuit results · tutor tokens · progress)" --> PRESENTATION
    APPLICATION --> DATA
    AgentSvc -- "SDK fork" --> MicroVM
    QuantumSvc -- "SDK fork (Qiskit Aer)" --> MicroVM
    RAGSvc --> LLM
    RAGSvc --> KnowledgeBase
    RAGSvc --> DB
```

---

## Low-Level Architecture

Six layers — each has its own module doc:

| Layer | Summary | Detail |
|-------|---------|--------|
| **1. Frontend** | **Public surface:** marketing landing page at `/` (auth-gated, `components/home/`). **App surface:** VS Code-style IDE shell — 6 zones, 6 modes, 7 Zustand stores, Supabase Realtime for events | [`docs/frontend-layer.md`](docs/frontend-layer.md) |
| **2. Backend Services** | FastAPI microservices — API Gateway + 11 domain services; `API Router → Service → Repository → PostgreSQL` | [`backend/design.md`](backend/design.md) |
| **3. Quantum Backend** | Adapter pattern — `QiskitAerAdapter` forks Vercel Sandbox microVM; FastAPI stays I/O-bound | [`docs/quantum-execution.md`](docs/quantum-execution.md) |
| **4. Code Execution Sandbox** | Vercel Sandbox managed microVM (via `SandboxRunner`) — both student code and quantum circuits; deny-all network, 2 GB, 30s | [`docs/sandbox.md`](docs/sandbox.md) |
| **5. AI & Knowledge** | `get_llm()` backed by **ModelRouter** — proactive RPM/RPD/TPM/TPD-aware routing across a pool of free-tier models + reactive LangChain fallback chain + RAG pipeline (BM25 + pgvector + RRF + Cross-Encoder reranker) | [`docs/llm-model-router.md`](docs/llm-model-router.md) · [`docs/rag-pipeline.md`](docs/rag-pipeline.md) · [`docs/agents.md`](docs/agents.md) |
| **6. Data Storage** | Supabase (Auth + PostgreSQL + pgvector + Realtime) · Docker Compose for local dev | [`docs/database.md`](docs/database.md) · [`docs/infrastructure.md`](docs/infrastructure.md) |

> Redis is not in the initial stack — deferred to Phase 2 when profiling shows a specific hot path.

---

## LLM Model Routing

Full detail: [`docs/llm-model-router.md`](docs/llm-model-router.md)

### Problem

Every free-tier model is capped on four dimensions at once — requests per minute (RPM), requests per day (RPD), tokens per minute (TPM), tokens per day (TPD) — and the first one hit returns a 429. The naive approach — always try the primary model, fall back after a 429 — burns requests against those walls before recovering.

### Key insight

Groq assigns **independent quotas per model** (shared across the whole organization, not per API key), and refills each one continuously rather than resetting on a clock boundary. The router treats the model list as a **capacity pool**: it mirrors each quota with a refilling bucket and sends each request to the model with the most headroom.

### Two-layer design

```mermaid
flowchart LR
    REQ(["get_llm(est_tokens) called"])

    subgraph L1["Layer 1 — Proactive Routing (ModelRouter)"]
        direction TB
        WINDOW["Refilling buckets per model\nRPM · RPD · TPM · TPD\n(synced from Groq rate-limit headers)"]
        RANK["Rank: ready → daily reserve → cooling down\nwithin a tier, most headroom first"]
        PICK["Pick ordered[0]\nreserve 1 request + est_tokens"]
        WINDOW --> RANK --> PICK
    end

    subgraph L2["Layer 2 — Reactive Fallback (LangChain)"]
        direction TB
        CALL["LLM API call\nordered[0] as primary"]
        FB["on any Exception:\ntry ordered[1], [2], ..."]
        CALL -->|"provider error / 429"| FB
    end

    REQ --> L1 --> L2
    L2 -->|"token stream"| RESP(["Response"])
```

### Request flow through ModelRouter

```mermaid
sequenceDiagram
    participant S as Service (e.g. TutorService)
    participant G as get_llm()
    participant R as ModelRouter
    participant P as LLM Provider

    S->>G: get_llm(est_tokens)
    G->>R: get_ordered_models(all_models, est_tokens)
    Note over R: refill buckets<br/>tier: ready / daily reserve / cooling down<br/>sort by headroom within tier
    R-->>G: [groq/openai/gpt-oss-120b, groq/qwen/qwen3.8-27b, ...]
    G->>R: record(ordered[0], est_tokens)
    G->>G: build primary.with_fallbacks(ordered[1:])
    G-->>S: Runnable chain

    S->>P: astream(messages)
    alt success
        P-->>S: token stream
        P-->>R: usage callback: real tokens + x-ratelimit-remaining-* headers
    else 429 / error
        P-->>R: failure callback: refund tokens, cool down for retry-after
        Note over G,P: LangChain tries ordered[1], ordered[2]...
        P-->>S: token stream from fallback
    end
```

### Free-tier capacity pool

| Model | RPM | RPD | TPM | Notes |
|-------|-----|-----|-----|-------|
| `groq/openai/gpt-oss-120b` | 30 | 1,000 | 8,000 | Primary |
| `groq/openai/gpt-oss-20b` | 30 | 1,000 | 8,000 | |
| `groq/qwen/qwen3.8-27b` | 30 | 1,000 | 8,000 | |

**TPM, not RPM, is the binding limit.** Steady state ≈ 24,000 ÷ tokens per request. Tutor prompts run ~5,300–11,600 tokens in the worst case, which is **~2–4 RPM**; a Docker load test at 40 RPM saw 55% of requests fail with 429s once all three models ran out of TPM. Daily ceiling: **3,000 requests**. Sustained 250–300 RPM requires a paid Groq tier, configured through `LLM_MODEL_LIMITS`.

### Shared conversation context

Switching models per turn would break conversation continuity. Every `get_llm()` call injects the full `AgentMessage` history from PostgreSQL into the message list so every model in the pool sees the complete prior conversation regardless of which one was selected.

```mermaid
flowchart TD
    DB[("PostgreSQL\nAgentMessage rows")]
    FETCH["Fetch prior messages\nfor session_id\n(capped at 20 rows / 10 turns)"]
    BUILD["Build message list\nSystemMessage\n+ HumanMessage turn 1\n+ AIMessage turn 1\n+ ...\n+ HumanMessage current"]
    LLM["get_llm().astream(messages)"]
    DB --> FETCH --> BUILD --> LLM
```

Context travels in the **payload**, not in the model's memory — any model in the pool can handle any turn coherently.

### Upgrade path to multi-replica

Bucket state is in-process (`threading.Lock` + refilling buckets). When multiple API replicas are deployed, back `record`, `adjust_tokens`, `sync_from_headers` and `mark_rate_limited` with Redis (see [`docs/llm-model-router.md`](docs/llm-model-router.md)). All callers and `get_ordered_models()` are unchanged.

---

## Engineering Rules

1. Inspect the repository before changing architecture
2. Plan before implementing major features
3. Use SQLAlchemy 2.x for all database access
4. Use Alembic for every schema migration — never `Base.metadata.create_all()` in production
5. Keep quantum computation deterministic and separate from LLM reasoning
6. Validate AI-generated circuits before execution
7. Never execute student code or Qiskit inside the API process
8. Keep quantum backends behind the `QuantumBackend` interface
9. Keep agents specialized — one clear responsibility per agent
10. Use structured agent inputs/outputs
11. Use RAG for factual technical information where appropriate
12. Track learner mastery as a first-class domain concept (BKT)
13. Keep API schemas separate from ORM models
14. Prefer service → repository architecture; keep routers thin
15. Write unit tests for deterministic logic
16. Write integration tests for database, AI, and quantum boundaries
17. Do not expose secrets to clients
18. Do not hardcode environment-specific configuration
19. Prefer incremental changes over rewrites
20. Document important architectural decisions

---

## Product Principle

Q-Learn is **not** a chatbot with a quantum simulator.

It is an adaptive learning system where **AI tutoring + learner modeling + quantum computation + assessment + visualization** work together.

The core loop:

**LEARN → BUILD → SIMULATE → OBSERVE → EXPLAIN → PRACTICE → EVALUATE → ADAPT**
