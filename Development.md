# Q-Learn — Development Plan

## Overview

This document contains all development-related information for Q-Learn — including the development philosophy, phases, testing strategy, project quality expectations, evaluation metrics, and getting started instructions.

**Related documentation:**
- [`Architecture.md`](Architecture.md) — high-level system diagram and layer summary
- [`docs/infrastructure.md`](docs/infrastructure.md) — production stack, env vars, deployment
- [`docs/database.md`](docs/database.md) — ERD, key tables, migration strategy
- [`docs/agents.md`](docs/agents.md) — LangGraph agent topology and AsyncPostgresSaver
- [`docs/sandbox.md`](docs/sandbox.md) — Vercel Sandbox microVM architecture
- [`docs/security.md`](docs/security.md) — security controls, auth flow, RBAC
- [`docs/payment-system-design.md`](docs/payment-system-design.md) — billing, Razorpay, entitlement gates
- [`backend/design.md`](backend/design.md) — full backend implementation detail
- [`frontend/design.md`](frontend/design.md) — full frontend implementation detail

---

## Table of Contents

- [Development Philosophy](#development-philosophy)
- [Development Phases](#development-phases)
- [MVP Scope](#mvp-scope)
- [Project Quality Expectations](#project-quality-expectations)
- [Code Rules](#code-rules)
- [Testing Strategy](#testing-strategy)
- [Evaluation Metrics](#evaluation-metrics)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [References](#references)
- [License](#license)
- [Claude Code Operating Rules](#claude-code-operating-rules)

---

## Development Philosophy

Before implementing any major feature:

1. Understand the requirement
2. Inspect the repository
3. Identify dependencies
4. Create an implementation plan
5. Identify affected modules
6. Consider edge cases
7. Consider security
8. Consider testing
9. Implement
10. Test
11. Review
12. Document

**Do not start coding immediately after receiving a feature request. Planning comes first.**

---

## Development Phases

### Phase 0 — Foundation (Week 1)
- [ ] Monorepo scaffold (Turborepo)
- [ ] Next.js frontend app structure
- [ ] FastAPI backend app structure
- [ ] Shared packages (schemas, quantum-core)
- [ ] Supabase project setup (Auth, PostgreSQL, pgvector, Storage, Realtime)
- [ ] Docker Compose: PostgreSQL+pgvector, API, Web (development — no Redis in Phase 0)
- [ ] GitHub Actions CI/CD
- [ ] Database schema creation (Alembic migrations) — see [`docs/database.md`](docs/database.md)
- [ ] Supabase Auth integration (register, login, JWT, RBAC) — see [`docs/security.md`](docs/security.md)
- [ ] Vercel Sandbox base snapshot (`qlearn-python-base`) with Qiskit Aer pre-installed
- [ ] `QiskitAerAdapter` via `AsyncSandbox.fork()` — see [`docs/sandbox.md`](docs/sandbox.md)
- [ ] Supabase Realtime publish pattern (FastAPI publishes; frontend subscribes via JS SDK)
- [ ] LangGraph `AsyncPostgresSaver` checkpointer — see [`docs/agents.md`](docs/agents.md)
- [ ] Basic project documentation

### Phase 1 — MVP Vertical Slice (Week 2-3)
- [ ] Student dashboard with progress
- [ ] Quantum curriculum (12 levels with seed data)
- [ ] Lesson system (content delivery)
- [ ] AI Tutor (RAG-powered, grounded answers)
- [ ] Basic RAG pipeline (ingestion, search, retrieval)
- [ ] Visual circuit builder (React Flow + custom nodes)
- [ ] Qiskit Aer execution (compile, validate, simulate)
- [ ] Measurement probability visualization
- [ ] Basic state vector display
- [ ] Quiz generation (dynamic questions)
- [ ] Skill tracking (BKT-based mastery)
- [ ] User journey: login → lesson → circuit → execute → quiz → evaluation → progress
- [ ] Payment integration (Razorpay subscriptions, feature-gated Pro) — see [`docs/payment-system-design.md`](docs/payment-system-design.md)
- [ ] Pricing page + upgrade modal
- [ ] Billing settings (manage / cancel subscription)

### Phase 2 — Agentic Intelligence (Week 4-6)
- [ ] LangGraph multi-agent system
- [ ] Learning Orchestrator Agent
- [ ] Circuit Agent with validation and explanation
- [ ] Evaluation Agent
- [ ] Recommendation Agent with personalized paths
- [ ] Research Agent with citations
- [ ] Tutor Agent with adaptive difficulty
- [ ] Secure code execution sandbox (Vercel Sandbox microVM) — see [`docs/sandbox.md`](docs/sandbox.md)
- [ ] Coding challenges with auto-evaluation
- [ ] Circuit debugging and feedback
- [ ] Student knowledge graph
- [ ] PennyLane adapter
- [ ] Cirq adapter
- [ ] Instructor dashboard
- [ ] Advanced analytics

### Phase 3 — Advanced Features (Week 7+)
- [ ] Real quantum hardware integration (IBM Quantum)
- [ ] Advanced quantum algorithms (full implementations)
- [ ] Collaborative circuit building
- [ ] Classroom assignments
- [ ] 3D Bloch sphere visualization
- [ ] Research mode
- [ ] Sophisticated learner modeling
- [ ] Learning analytics and experimentation
- [ ] Plugin system (multi-SDK support)

---

## MVP Scope (Must-Have for Launch)

1. ✅ Authentication (register/login, JWT, RBAC)
2. ✅ Student dashboard (progress overview)
3. ✅ Quantum curriculum (at least 3-4 levels with content)
4. ✅ Lesson system (lesson delivery)
5. ✅ AI Tutor (RAG-based, grounded answers)
6. ✅ Basic RAG (document ingestion, vector search)
7. ✅ Visual circuit builder (drag-and-drop, H, X, CX, Measurement gates)
8. ✅ Qiskit Aer execution (simulate circuits)
9. ✅ Measurement visualization (probability bar chart)
10. ✅ Basic state visualization (state vector table)
11. ✅ Quiz generation (conceptual questions)
12. ✅ Basic skill tracking (mastery scores)
13. ✅ Freemium + Pro subscription (Razorpay) — AI Tutor + execution gated behind Pro

**Do NOT initially build:** Every quantum algorithm, real quantum hardware, all 3 frameworks simultaneously, complex social features, mobile apps, excessive admin functionality.

---

## Project Quality Expectations

This is a **startup product** (originally a final-year engineering project, now in production-quality startup mode). Code must be:

- **Modular** — clear service boundaries, no monolithic files
- **Typed** — TypeScript on frontend, Python type hints on backend
- **Testable** — unit, integration, and E2E tests
- **Documented** — docstrings, README, architecture docs
- **Maintainable** — clear abstractions, no hardcoded logic
- **Observable** — structured logging, agent tracing
- **Secure** — RBAC, input validation, sandboxed execution
- **Easy to extend** — adapter patterns, configurable thresholds

---

## Code Rules

- Do not build a giant monolithic file
- Do not hardcode business logic everywhere
- Do not put AI prompts throughout random files — centralize agent definitions/prompts/configuration
- Use clear service boundaries
- Prefer incremental changes over rewrites
- Plan before coding (understand → inspect → identify → plan → implement → test → review → document)

---

## Testing Strategy

> Boundaries to test against: [`docs/quantum-execution.md`](docs/quantum-execution.md) · [`docs/rag-pipeline.md`](docs/rag-pipeline.md) · [`docs/agents.md`](docs/agents.md) · [`docs/sandbox.md`](docs/sandbox.md)

### Unit Tests
- Circuit validation logic
- Learning calculations (BKT updates)
- Skill updates and mastery scoring
- Recommendation logic
- API service endpoints (mocked dependencies)

### Integration Tests
- API + PostgreSQL (Alembic schema via [`docs/database.md`](docs/database.md))
- AI service + RAG pipeline (see [`docs/rag-pipeline.md`](docs/rag-pipeline.md))
- Quantum service + `QiskitAerAdapter` (mock `AsyncSandbox.fork()` — see [`docs/sandbox.md`](docs/sandbox.md))
- Circuit → simulation → result flow
- Auth → protected routes (JWT + RBAC — see [`docs/security.md`](docs/security.md))

### End-to-End Tests
**Student journey:** login → lesson → circuit → execute → quiz → evaluation → progress
**AI evaluation:** factual correctness, citation correctness, circuit correctness, response quality, adaptation quality

---

## Evaluation Metrics

| Category | Metrics |
|----------|---------|
| **Platform** | API latency, simulation latency, system reliability |
| **AI** | Answer correctness, groundedness, citation accuracy, hallucination rate |
| **Learning** | Pre-test vs post-test improvement, quiz accuracy, concept mastery improvement, challenge completion, learning progression |
| **Personalization** | Compare static vs adaptive learning paths (academic evaluation component) |

---

## Getting Started

**Production Stack:** Supabase + FastAPI (Railway) + Vercel (frontend + Sandbox)

> Full infrastructure detail, environment variables, and deployment instructions: [`docs/infrastructure.md`](docs/infrastructure.md)

### Prerequisites
- Supabase account (project created)
- Vercel account (Hobby plan — for Sandbox)
- Node.js 20+
- Python 3.11+
- pnpm
- Docker & Docker Compose v2.0+ (development only)

### Quick Start (Development)

```bash
# Clone the repository
git clone <repo-url>
cd qlearn

# Copy environment template (see docs/infrastructure.md for all variables)
cp .env.example .env

# Start all services (Docker Compose for development)
docker compose up --build

# Frontend:  http://localhost:3000
# API:       http://localhost:8000
# API docs:  http://localhost:8000/docs
```

### Deployment

See [`docs/infrastructure.md`](docs/infrastructure.md) for the full production deployment guide.

| Service | Platform | Purpose |
|---------|----------|---------|
| Frontend (Next.js) | Vercel | Deploy & host frontend |
| Backend (FastAPI) | Railway (Free → paid) | API, AI agents, RAG, quantum execution |
| Database + Auth | Supabase | PostgreSQL + pgvector, Storage, Realtime |
| Code + Quantum Execution | Vercel Sandbox (Hobby plan) | Isolated microVM — student code and Qiskit Aer |
| CI/CD | GitHub Actions | Automated pipeline |

> **Architecture is portable.** The FastAPI service runs in a Docker container and can move to Railway, Fly.io, or any VPS without redesigning Q-Learn.

### Database Schema

See [`docs/database.md`](docs/database.md) for the full ERD, key tables reference, and migration strategy.

Core entity groups:
- `users` / `user_profiles`
- `courses` / `modules` / `lessons` / `concepts`
- `student_progress` / `skill_mastery` (BKT)
- `circuits` / `circuit_executions`
- `quiz_questions` / `quiz_attempts` / `coding_challenges` / `challenge_attempts`
- `agent_sessions` / `agent_messages` (LangGraph + AsyncPostgresSaver)
- `knowledge_documents` / `document_chunks` / `knowledge_embeddings` (pgvector dim=384)

---

## Contributing

### Agent Design Principle

> Full agent topology, responsibilities, and state persistence: [`docs/agents.md`](docs/agents.md)

Each agent should have:
- Clear input and output
- Defined responsibility
- Tools it is allowed to use
- Context requirements
- Error handling

Agents should NOT directly manipulate the database unless explicitly required. Prefer service/tool interfaces.

### Development Philosophy

See [Development Philosophy](#development-philosophy) above — same rules apply to all contributions.

---

## References

- [SIH 2026 Problem Statement SIH2614](https://www.sih.gov.in/)
- [Qiskit Documentation](https://qiskit.org/documentation/)
- [Qiskit Aer](https://qiskit.org/ecosystem/aer/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangChain Documentation](https://langchain.com/docs)
- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [React Flow Documentation](https://reactflow.dev/)
- [pgvector Documentation](https://pgvector.org/)
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing)

---

## License

Q-Learn is a startup product. Originally developed for Smart India Hackathon 2026 (Problem Statement SIH2614), now operating in startup mode with a commercial freemium + subscription model.

---

## Claude Code Operating Rules

When implementing features for this project:

1. **First plan internally** covering: what changes, why, which files/modules affected, data/API changes, AI/agent implications, testing strategy, potential risks
2. **Then implement** — do not blindly modify files
3. **Do not rewrite working code** without reason
4. **Prefer incremental changes** over rewrites
5. **Read the entire Development.md** before any major change
6. **Inspect the repository** before implementing
7. **Wait for approval** before making major architectural changes

**The first objective is understanding and planning, not coding. Treat Q-Learn as a long-term production-quality final-year project.**
