# Q-Learn

**Adaptive multi-agent AI platform for interactive quantum computing education.**

Q-Learn is a startup product that combines AI tutoring, personalized learning, quantum circuit construction, Qiskit simulation, and adaptive assessment into a single interactive quantum learning laboratory.

> Originally built for Smart India Hackathon 2026 — Problem Statement **SIH2614**.

---

## What makes it different

Most quantum learning tools are either static docs or a bare Qiskit playground. Q-Learn closes the loop:

```
LEARN → BUILD → SIMULATE → OBSERVE → EXPLAIN → PRACTICE → EVALUATE → ADAPT
```

**Core feature — "Explain My Circuit":** A student builds a circuit. Q-Learn explains what each gate does, how the quantum state changes, the mathematical transformation, why the measurement probabilities look that way, what mistakes were made, and what to learn next.

The system connects: **MATHEMATICS ↔ QUANTUM STATE ↔ CIRCUIT ↔ CODE ↔ SIMULATION ↔ MEASUREMENT**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 · TypeScript · React Flow · Tailwind · Zustand |
| Backend | FastAPI · Python 3.11 · SQLAlchemy 2.x · Alembic |
| AI / Agents | LangGraph · LangChain · LlamaIndex · pgvector · Sentence Transformers |
| Quantum | Qiskit Aer (via Vercel Sandbox microVM) |
| Database | Supabase (PostgreSQL + pgvector + Auth + Realtime) |
| Execution | Vercel Sandbox — isolated microVM for student code and Qiskit |
| Payments | Razorpay (freemium + Pro subscriptions) |
| Hosting | Vercel (frontend) · Railway (FastAPI) · Supabase Cloud |
| CI/CD | GitHub Actions |

---

## Architecture

Three-tier: **Presentation (Vercel)** → **Application (Railway/FastAPI)** → **Data & Infrastructure (Supabase + Vercel Sandbox)**

Key design decisions:
- **No WebSocket endpoints on FastAPI** — real-time events flow via Supabase Realtime pub/sub; FastAPI publishes, frontend subscribes via Supabase JS SDK
- **No in-process Qiskit** — all circuit simulation and student code runs inside a Vercel Sandbox microVM (`AsyncSandbox.fork(qlearn-python-base)`); FastAPI stays I/O-bound
- **Agent state in PostgreSQL** — LangGraph uses `AsyncPostgresSaver`; agent sessions survive restarts and scale across replicas
- **No Redis in Phase 0–1** — deferred until profiling shows a specific hot path

Full detail: [`Architecture.md`](Architecture.md) · [`docs/`](docs/)

---

## Monetization

Freemium + Razorpay subscriptions (Indian market — UPI, cards, netbanking).

| Feature | Free | Pro |
|---------|------|-----|
| Full curriculum (all 12 levels) | ✅ | ✅ |
| All lessons | ✅ | ✅ |
| AI Tutor | — | ✅ |
| Qiskit circuit execution | — | ✅ |
| Adaptive quiz generation | — | ✅ |

The paywall aligns with cost drivers (LLM calls + Vercel Sandbox forks). Full billing spec: [`docs/payment-system-design.md`](docs/payment-system-design.md)

---

## Quick Start (Development)

**Prerequisites:** Node.js 20+, Python 3.11+, pnpm, Docker & Docker Compose v2+, Supabase account, Vercel account (Hobby plan)

```bash
git clone <repo-url>
cd qlearn

cp .env.example .env
# fill in: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET, DATABASE_URL,
#          VERCEL_TOKEN, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, LLM_PRIMARY_MODEL
# Team members: see docs/onboarding.md for which values are shared vs. local.

docker compose up --build
# Frontend  →  http://localhost:3000
# API       →  http://localhost:8000
# API docs  →  http://localhost:8000/docs
```

Run migrations:
```bash
cd backend
alembic upgrade head
```

New to the team? See [`docs/onboarding.md`](docs/onboarding.md) for the shared-Supabase setup. See [`docs/infrastructure.md`](docs/infrastructure.md) for the full environment variable reference and production deployment guide.

---

## Live deployment

| Service | URL |
|---------|-----|
| API (Railway, production) | `https://q-learn-api-production.up.railway.app` |
| Health check | `https://q-learn-api-production.up.railway.app/health` |
| API docs (Swagger) | `https://q-learn-api-production.up.railway.app/docs` |

Frontend points at the API via `NEXT_PUBLIC_API_URL`.

> **URL won't load? (`DNS_PROBE_POSSIBLE` / "This site can't be reached")** — some ISP/router DNS resolvers fail on `*.up.railway.app` even though the API is healthy. Enable Secure DNS in your browser (Brave/Chrome → *Settings → Privacy & security → Use secure DNS → Cloudflare 1.1.1.1*) and reload. Full steps + verification commands: [`docs/infrastructure.md`](docs/infrastructure.md#troubleshooting-dns_probe_possible--this-site-cant-be-reached).

---

## Curriculum

12 levels from quantum intuition to Shor's algorithm. Each concept follows:
**Concept → Intuition → Mathematics → Circuit → Code → Simulation → Practice**

---

## Documentation

| Document | Contents |
|----------|----------|
| [`Architecture.md`](Architecture.md) | System diagram, layer summary, engineering rules |
| [`Project.md`](Project.md) | Full product spec, agent architecture, learning model |
| [`Development.md`](Development.md) | Phases, MVP scope, testing strategy, getting started |
| [`docs/frontend-layer.md`](docs/frontend-layer.md) | VS Code shell, Zustand stores, design system |
| [`docs/agents.md`](docs/agents.md) | LangGraph agent topology, AsyncPostgresSaver |
| [`docs/quantum-execution.md`](docs/quantum-execution.md) | QiskitAerAdapter, Vercel Sandbox fork sequence |
| [`docs/rag-pipeline.md`](docs/rag-pipeline.md) | BM25 + pgvector hybrid, reranker, knowledge base |
| [`docs/database.md`](docs/database.md) | ERD, key tables, migration strategy |
| [`docs/security.md`](docs/security.md) | Auth flow, RBAC, security controls |
| [`docs/payment-system-design.md`](docs/payment-system-design.md) | Razorpay subscriptions, entitlement gates |
| [`docs/infrastructure.md`](docs/infrastructure.md) | Production stack, env vars, deployment |
| [`backend/design.md`](backend/design.md) | Full backend implementation detail |
| [`frontend/design.md`](frontend/design.md) | Full frontend implementation detail |

---

## Development Phases

| Phase | Scope | Timeline |
|-------|-------|----------|
| **0 — Foundation** | Scaffold, auth, DB schema, Vercel Sandbox, Realtime, AsyncPostgresSaver | Week 1 |
| **1 — MVP** | Curriculum, AI Tutor, circuit builder, Qiskit execution, quiz, payments | Week 2–3 |
| **2 — Agentic** | LangGraph multi-agent system, coding challenges, PennyLane/Cirq adapters | Week 4–6 |
| **3 — Advanced** | IBM Quantum hardware, 3D Bloch sphere, collaborative circuits | Week 7+ |

---

## License

Q-Learn is a startup product — commercial freemium + subscription. Originally developed for Smart India Hackathon 2026 (SIH2614).
