# Infrastructure & Deployment

---

## Production Stack

| Service | Platform | Purpose |
|---------|----------|---------|
| **Supabase** | Supabase Cloud | Auth, PostgreSQL + pgvector, Storage, Realtime pub/sub |
| **FastAPI** | Railway (Free → paid) | API gateway, AI agents, RAG; publishes to Supabase Realtime |
| **Frontend** | Vercel | Deploy & host Next.js application |
| **Vercel Sandbox** | Vercel (Hobby plan) | Isolated microVM for student code **and** quantum circuit simulation |
| **CI/CD** | GitHub Actions | Automated test + deploy pipeline |

---

## Development Stack (Docker Compose)

```yaml
services:
  postgres:    # PostgreSQL 16 + pgvector
  api:         # FastAPI backend (uvicorn --reload)
  web:         # Next.js frontend (next dev)
```

All services on localhost — Frontend: `http://localhost:3000` · API: `http://localhost:8000` · Docs: `http://localhost:8000/docs`

---

## Infrastructure Components

| Component | Purpose |
|-----------|---------|
| **Supabase** | Auth, PostgreSQL + pgvector, Storage, Realtime (production) |
| **Vercel Sandbox** | Isolated execution microVM — managed, no self-hosted Docker needed |
| **Docker Compose** | Development environment, one-command setup |
| **Nginx** | Reverse proxy, TLS termination (production) |
| **PgBouncer** | PostgreSQL connection pooling (production) |
| **Prometheus + Grafana** | Monitoring and observability |
| **GitHub Actions** | CI/CD pipeline |

---

## Environment Variables

All configuration via environment variables. See `backend/.env.example` for the full reference.

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (backend only) |
| `SUPABASE_ANON_KEY` | Supabase anon key (frontend) |
| `SECRET_KEY` | JWT signing key |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `LLM_PROVIDER` | `ollama` / `openai` / `anthropic` / `gemini` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | LLM provider keys |
| `VERCEL_TOKEN` / `VERCEL_TEAM_ID` | Vercel Sandbox SDK credentials |
| `SANDBOX_BASE_NAME` | Base snapshot name (`qlearn-python-base`) |
| `SANDBOX_TIMEOUT` | microVM timeout in ms (default: `30000`) |
| `CORS_ORIGINS` | Allowed frontend origins (Vercel URL) |

> `REDIS_URL` is **not** required in Phase 0–1. Added when profiling shows a specific caching bottleneck.

**Never hardcode environment-specific configuration.**

---

## Production Deployment

- **Supabase** manages Auth, PostgreSQL + pgvector, Storage, and Realtime (WebSocket pub/sub)
- **Vercel** hosts the Next.js frontend
- **Docker container** runs the FastAPI backend on Railway (Free → paid as load requires)
- **Vercel Sandbox** handles all isolated execution — student code and quantum circuit simulation
- **Real-time events** flow via Supabase Realtime channels — no FastAPI WebSocket endpoints
- **Horizontal scaling**: FastAPI is stateless (JWT auth, `AsyncPostgresSaver` for agent state) — add Railway replicas freely
- **Monitoring**: Prometheus + Grafana stack
- **CI/CD**: GitHub Actions automated pipeline

> **Architecture is portable.** FastAPI runs in a Docker container and can move to Railway, Fly.io, or any VPS without redesigning Q-Learn.
