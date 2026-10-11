# Observability (Sentry)

Q-Learn uses two separate Sentry projects for error monitoring and
performance tracing. Both are disabled by default — the SDKs only activate
when a DSN is configured, so local dev and tests are unaffected.

| Project | Covers |
|---|---|
| `python-fastapi` | Backend (`backend/app`) — unhandled exceptions, request tracing, LLM routing breadcrumbs, sandbox run status/duration |
| `javascript-nextjs` | Frontend (`frontend/src`) — browser + server render errors, route transitions, build-time source maps |

LangSmith remains the tool for AI workflow *debugging* (full traces, prompts,
chain-of-thought). Sentry only sees operational signal: did a request fail,
how long did it take, which model/route/agent was involved — never prompt or
response content.

## What is NOT sent to Sentry

- Request/response bodies, cookies, `Authorization` headers (stripped in
  `backend/app/core/sentry.py`'s `before_send` and the frontend's
  `beforeSend` in `sentry.{client,server}.config.ts`)
- LLM prompts, completions, or chain-of-thought — `agents/llm.py` only
  attaches `model` name and token counts as breadcrumbs
- Submitted code / sandbox stdout — `quantum/sandbox_runner.py` only reports
  `exit_code` and `duration_ms`
- Expected/handled errors (`QlearnError` and its subclasses) — these are
  fully resolved by `qlearn_exception_handler` and never reach Sentry as
  unhandled exceptions. Only genuinely unexpected exceptions are captured.

## Environment variables

### Backend (`backend/.env`, Railway)

| Variable | Default | Purpose |
|---|---|---|
| `SENTRY_DSN` | *(empty)* | Empty disables the SDK entirely |
| `SENTRY_ENVIRONMENT` | `development` | Set to `staging`/`production` per Railway environment |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.05` | Fraction of requests traced — raise cautiously, watch Sentry quota |
| `SENTRY_PROFILES_SAMPLE_RATE` | `0.0` | Profiling rides on traced transactions; real overhead, opt in deliberately |

### Frontend (`frontend/.env.local`, Vercel)

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | *(empty)* | Public by necessity (bundled into the client); empty disables the SDK |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `development` | Client-side environment tag |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.05` | Client tracing sample rate |
| `SENTRY_ENVIRONMENT` / `SENTRY_TRACES_SAMPLE_RATE` | same defaults | Server/edge runtime equivalents |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | *(empty)* | Build-time only, for source-map upload. Set in Vercel/CI, **never** locally, **never** `NEXT_PUBLIC_*` |

### Manual steps required

- **Railway (backend service):** set `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`, and a deliberate `SENTRY_TRACES_SAMPLE_RATE` under the service's Variables tab.
- **Vercel (frontend project):** set `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production`, and `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` (as a **Secret**, Production + Preview) so source maps upload on each Vercel build.
- **Sentry dashboard:** confirm the two projects' alert rules/routing match your on-call setup — this integration does not configure alerting.

## Verifying locally

1. Copy the DSNs into `backend/.env` (`SENTRY_DSN=...`) and `frontend/.env.local` (`NEXT_PUBLIC_SENTRY_DSN=...`). Both files are gitignored.
2. Backend: start the API (`uvicorn app.main:app --reload`) and hit any route that raises — or add a temporary `raise RuntimeError("test")` in a route — then check the Sentry `python-fastapi` project's Issues tab.
3. Frontend: start `pnpm dev`, throw in a client component (e.g. `throw new Error("test")` inside a `useEffect`), and confirm it surfaces in the `javascript-nextjs` project and triggers `src/app/error.tsx`.
4. Remove any temporary test code before committing — don't ship a route that deliberately throws.

## Sampling and cost

Both `*_TRACES_SAMPLE_RATE` defaults (`0.05`) are deliberately conservative —
tune per environment via env vars, not by editing the code defaults. Backend
profiling (`SENTRY_PROFILES_SAMPLE_RATE`) stays at `0.0` until a concrete need
for CPU-level profiles justifies the overhead.

## Disabling locally

Leave `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` unset (the default in
`.env.example`) — both SDKs no-op completely, confirmed by
`backend/tests/test_sentry.py::test_init_sentry_is_noop_without_dsn`.

## Troubleshooting

- **No events showing up:** confirm the DSN is set and not the placeholder from `.env.example`; check `sentry_enabled`/`sentry_disabled` in the structlog output at API startup.
- **Expected (`QlearnError`) exceptions appearing as issues:** they shouldn't — if they do, check that the route didn't re-raise after the handler ran, or that a bug bypassed `qlearn_exception_handler`.
- **Frontend build fails on source-map upload:** unset `SENTRY_AUTH_TOKEN` locally; the webpack plugin is already skipped automatically when it's absent (see `frontend/next.config.mjs`).

## Opportunities not implemented here

Custom LangGraph spans (per-node timing inside the tutor graph) would need the
agent graph to expose span boundaries explicitly — out of scope for this pass
to avoid an invasive refactor. The current breadcrumbs (`llm_routed`,
`llm_attempt_failed`, `sandbox_run_complete`) give route/model/duration/failure
visibility without touching agent internals; revisit if Sentry-level
per-node tracing becomes a real need.
