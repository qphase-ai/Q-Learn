# Infrastructure & Deployment

![Q-Learn infrastructure & data flow](infrastructure-diagram.svg)

---

## Production Stack

| Service | Platform | Purpose |
|---------|----------|---------|
| **Supabase** | Supabase Cloud | Auth, PostgreSQL + pgvector, Storage, Realtime pub/sub |
| **FastAPI** | InstaCloud (compute service `api`) | API gateway, AI agents, RAG; publishes to Supabase Realtime |
| **Frontend** | Vercel | Deploy & host Next.js application |
| **Vercel Sandbox** | Vercel (Hobby plan) | Isolated microVM for student code **and** quantum circuit simulation |
| **CI/CD** | GitHub Actions | Automated test + deploy pipeline |

### Live endpoints

| Service | URL |
|---------|-----|
| **API (InstaCloud, production)** | `https://prod-main-api-e7ab8e-008pmc86yhk.compute.instacloud-edge.com` |
| **API health check** | `https://prod-main-api-e7ab8e-008pmc86yhk.compute.instacloud-edge.com/health` |
| **API docs (Swagger)** | `https://prod-main-api-e7ab8e-008pmc86yhk.compute.instacloud-edge.com/docs` |

Frontend must point at this via `NEXT_PUBLIC_API_URL` in Vercel (production + preview). It is inlined at build time, so redeploy the frontend after changing it.

### Backend hosting (InstaCloud)

The API runs as the `api` compute service in the InstaCloud project `q-learn` (branch `main`, region `us-east`, always-on, port `8000`), built from `backend/Dockerfile`. It has no InstaCloud database: `DATABASE_URL` points at Supabase, and every backend variable is stored as an InstaCloud project secret. The repo is linked through `.insta/project.json`.

```bash
insta status                                  # login + linked project
insta secrets list                            # names only; values never printed
insta secrets set NAME                        # value on stdin; restart/redeploy to apply
insta compute status api
insta compute logs api --limit 100            # runtime logs
insta compute logs api --deploy               # deploy/build events
```

**Deploying.** Deploy from a clean export of committed code, never the working tree: `backend/` has no `.dockerignore`, so a direct `insta deploy backend` would bake local `.env*` files into the image.

```bash
rm -rf /tmp/qlearn-deploy && mkdir -p /tmp/qlearn-deploy
git archive HEAD backend | tar -x -C /tmp/qlearn-deploy
insta deploy /tmp/qlearn-deploy/backend --group api --port 8000
curl -s https://prod-main-api-e7ab8e-008pmc86yhk.compute.instacloud-edge.com/health   # → {"status":"ok",...}
```

The container runs `alembic upgrade head` before uvicorn starts (see `backend/Dockerfile`), so pending migrations are applied to Supabase on every deploy. A failing migration therefore keeps the new machine from becoming healthy; check `insta compute logs api`.

#### CI deploy

The `deploy-backend` job in `.github/workflows/ci.yml` deploys `backend/` to `api` on branch `main` on every push to `main`, after the `backend` test job passes. It then polls `/health` and fails the run, printing the last 100 log lines, if the endpoint doesn't return 200. Deploys are queued, never cancelled mid-flight. Pull requests don't deploy.

The job needs one repository secret, `INSTA_API_KEY`: an InstaCloud token scoped to this project. A human has to create it, because agents can't mint tokens. Pipe it straight into GitHub so the plaintext is never displayed:

```bash
insta tokens create github-ci --project ed2f5dfe-9171-4268-9e94-3dcb6ea0ddbf --expires 1y \
  | gh secret set INSTA_API_KEY --repo qphase-ai/Q-Learn
```

The token expires after a year. Re-run the command to rotate it, and revoke the old one with `insta tokens revoke <id>`.

#### Branch environments

An InstaCloud branch (`insta branch create <name>`, max 10 per project) is an isolated copy of the project's services, with its own `api` URL. It starts out serving main's current image. **For Q-Learn a branch does not isolate data:** the database lives on Supabase, not in InstaCloud, so a branch inherits `DATABASE_URL` pointing at the **production** database. The container also runs `alembic upgrade head` on boot, so deploying a branch that adds a migration would migrate production.

Before deploying any code to a branch, give it its own database: add an InstaCloud Postgres on that branch (it ships the `vector` extension), or use a separate Supabase project. Then override `DATABASE_URL` for that branch only with `insta secrets set DATABASE_URL --branch <name>`. The URL must use the `postgresql+asyncpg://` prefix. Only then run `insta deploy backend --branch <name> --group api --port 8000`. Delete the branch with `insta branch delete <name>` when the work is merged; branch data never merges back.

**Railway (legacy).** The previous host, Railway `q-learn-api` (`https://q-learn-api-production.up.railway.app`), stays up during the soak period after the 2026-10-17 cutover and is then decommissioned. `backend/railway.json` is kept until then.

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
| `SUPABASE_JWT_SECRET` | Project JWT secret — backend verifies Supabase Auth access tokens (HS256) |
| `SECRET_KEY` | App secret (misc. signing) |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) — see the two-URL model below |
| `CHECKPOINT_DATABASE_URL` | Direct or session-mode `postgresql://…` URL (port 5432, not the `:6543` pooler) for the AI Classroom LangGraph checkpointer. Optional: falls back to `DATABASE_URL` when that is not on the pooler, otherwise the classroom runs without resumability |
| `LLM_PRIMARY_MODEL` | LiteLLM model string — default `gpt-4o-mini` |
| `LLM_FALLBACK_MODELS` | JSON list of fallback model strings — e.g. `["anthropic/claude-haiku-4-5-20251001","gemini/gemini-3.8-flash"]` |
| `LLM_TEMPERATURE` | Default `0.7` |
| `LLM_MAX_TOKENS` | Default `2048` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Set only for providers you use |
| `VERCEL_TOKEN` / `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID` | Vercel Sandbox SDK credentials — **all three are required**; if any is missing every circuit run fails with `SandboxCredentialsError: Missing credentials`. Scope the token to the team. See [`sandbox.md`](sandbox.md#production-setup) |
| `SANDBOX_SNAPSHOT_ID` | Qiskit-ready snapshot to restore per run (preferred) — build it with `python -m scripts.create_sandbox_snapshot` |
| `SANDBOX_IMAGE` | Custom OCI image with Qiskit preinstalled (alternative to snapshot) |
| `SANDBOX_VCPUS` / `SANDBOX_MEMORY` | Sandbox resources (default 1 vCPU / 2048 MB — Vercel minimum) |
| `SANDBOX_TIMEOUT` | microVM timeout in ms (default: `30000`) |
| `CORS_ORIGINS` | Allowed frontend origins (Vercel URL) |

> `REDIS_URL` is **not** required in Phase 0–1. Added when profiling shows a specific caching bottleneck.

**Never hardcode environment-specific configuration.**

### `DATABASE_URL` — two-URL model

Supabase exposes two connection endpoints. Use the right one for the job:

| Use | Endpoint | Port | Example host |
|-----|----------|------|--------------|
| **App runtime** (InstaCloud) | Transaction pooler (IPv4) | `6543` | `aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>` |
| **Migrations** | Direct connection | `5432` | `db.<ref>.supabase.co`, user `postgres` |

- Prefix must be `postgresql+asyncpg://` (this backend uses the asyncpg driver).
- `database.py` auto-detects port `6543` and disables asyncpg prepared statements + server-side pooling (required for pgbouncer transaction mode).
- Direct (`5432`) is IPv6-only unless the IPv4 add-on is enabled — if unreachable, run migrations through the **session-mode** pooler (port `5432` on the pooler host).
- Production URLs are kept in `backend/.env.production` (gitignored) and set as InstaCloud project secrets (`insta secrets set`). Local dev keeps `DATABASE_URL` on Docker Postgres.

### Row Level Security

RLS is **enabled on all `public` tables** (no policies). The backend connects with the `service_role` key, which bypasses RLS; this blocks direct PostgREST access via the public anon key. Add policies if any table must be reachable by the anon/authenticated roles directly.

---

## Production Deployment

- **Supabase** manages Auth, PostgreSQL + pgvector, Storage, and Realtime (WebSocket pub/sub)
- **Vercel** hosts the Next.js frontend
- **Docker container** runs the FastAPI backend on InstaCloud (always-on compute service `api`)
- **Vercel Sandbox** handles all isolated execution — student code and quantum circuit simulation
- **Real-time events** flow via Supabase Realtime channels — no FastAPI WebSocket endpoints
- **Horizontal scaling**: FastAPI is stateless (JWT auth, `AsyncPostgresSaver` for agent state) — add InstaCloud replicas with `insta compute scale <n> api` (paid plans)
- **Monitoring**: Prometheus + Grafana stack
- **CI/CD**: GitHub Actions automated pipeline

> **Architecture is portable.** FastAPI runs in a Docker container and can move to InstaCloud, Railway, Fly.io, or any VPS without redesigning Q-Learn.
