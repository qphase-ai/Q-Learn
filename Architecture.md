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
- [`docs/llm-model-router.md`](docs/llm-model-router.md) — ModelRouter design, RPM capacity pool, sliding-window algorithm, shared context
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
            MicroVM["Isolated microVM\npython3.13 • deny-all network\nQiskit Aer + Student Python"]
        end

        subgraph External["External"]
            LLM["LLM Pool (10 models)\nModelRouter → ChatLiteLLM\nGroq (×7) · Gemini · OpenRouter (×2)\n225 RPM reliable capacity"]
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
| **4. Code Execution Sandbox** | Vercel Sandbox managed microVM — both student code and quantum circuits; deny-all, 512 MB, 30s | [`docs/sandbox.md`](docs/sandbox.md) |
| **5. AI & Knowledge** | `get_llm()` backed by **ModelRouter** — proactive sliding-window RPM routing across 10 free-tier models (225 RPM reliable capacity) + reactive LangChain fallback chain + RAG pipeline (BM25 + pgvector + RRF + Cross-Encoder reranker) | [`docs/llm-model-router.md`](docs/llm-model-router.md) · [`docs/rag-pipeline.md`](docs/rag-pipeline.md) · [`docs/agents.md`](docs/agents.md) |
| **6. Data Storage** | Supabase (Auth + PostgreSQL + pgvector + Realtime) · Docker Compose for local dev | [`docs/database.md`](docs/database.md) · [`docs/infrastructure.md`](docs/infrastructure.md) |

> Redis is not in the initial stack — deferred to Phase 2 when profiling shows a specific hot path.

---

## LLM Model Routing

Full detail: [`docs/llm-model-router.md`](docs/llm-model-router.md)

### Problem

A single free-tier Groq model is capped at **30 RPM**. The naive approach — always try the primary model, fall back after a 429 — burns every request against the wall before recovering. At 200 RPM sustained load, six of every seven requests fail before any fallback is tried.

### Key insight

Groq assigns **independent quotas per model**. Seven Groq models = 7 × 30 RPM = 210 RPM of parallel, non-competing capacity. The router treats the fallback list as a **capacity pool**, not a disaster recovery list.

### Two-layer design

```mermaid
flowchart LR
    REQ(["get_llm() called"])

    subgraph L1["Layer 1 — Proactive Routing (ModelRouter)"]
        direction TB
        WINDOW["Sliding-window RPM counter\nper-model deque of timestamps\n60-second rolling window"]
        RANK["Rank by headroom\nheadroom = limit − len(window)\nsort descending"]
        PICK["Pick ordered[0]\n(most available capacity)"]
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

    S->>G: get_llm()
    G->>R: get_ordered_models(all_models)
    Note over R: trim stale timestamps (>60 s)<br/>compute headroom per model<br/>sort by headroom descending
    R-->>G: [groq/llama-3.3, groq/gemma2, gemini/flash, ...]
    G->>R: record(ordered[0])
    G->>G: build primary.with_fallbacks(ordered[1:])
    G-->>S: Runnable chain

    S->>P: astream(messages)
    alt success
        P-->>S: token stream
    else 429 / error
        Note over G,P: LangChain tries ordered[1], ordered[2]...
        P-->>S: token stream from fallback
    end
```

### Free-tier capacity pool

```mermaid
block-beta
    columns 4

    block:groq["Groq — 7 × 30 RPM"]:4
        A["llama-3.3-70b\n30 RPM"]
        B["llama-3.1-8b\n30 RPM"]
        C["deepseek-r1\n30 RPM"]
        D["gemma2-9b\n30 RPM"]
        E["mixtral-8x7b\n30 RPM"]
        F["llama3-70b\n30 RPM"]
        G["llama3-8b\n30 RPM"]
    end

    block:other["Other providers"]:4
        H["gemini-2.0-flash\n15 RPM"]
        I["openrouter ×2\n20 RPM each\n⚠ 50 req/day free"]
        space:2
    end
```

| Provider | Models | RPM | Notes |
|----------|--------|-----|-------|
| Groq | 7 | 7 × 30 = **210 RPM** | Independent quotas per model |
| Gemini | 1 | **15 RPM** | 1,500 req/day free |
| OpenRouter | 2 | 2 × 20 = **40 RPM** | 50 req/day free without credits |
| **Reliable total** | **8** | **225 RPM** | Groq + Gemini only |
| **Peak total** | **10** | **265 RPM** | All models |

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

The current counter is in-process (`threading.Lock` + `deque`). When multiple API replicas are deployed, swap the deque for a Redis sorted-set backend in two internal methods (`record` / `_count_last_minute`). All callers and `get_ordered_models()` are unchanged.

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
