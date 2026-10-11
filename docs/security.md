# Security Architecture

---

## Architecture

```mermaid
flowchart TD
    Browser["Browser\nHTTPS only"]
    GW["API Gateway\nCORS · Rate Limiting · Pydantic Validation · Structlog"]
    AUTH["Auth / RBAC\nSupabase Auth · verify access token (HS256)\nstudent / instructor / admin"]
    SVC["Application Services\nAuth · Learning · Quantum · Agents · RAG · Analytics · ..."]
    PG["PostgreSQL + pgvector\nSQLAlchemy parameterized queries\nAlembic migrations"]
    RT["Supabase Realtime\nWebSocket pub/sub broker"]
    VSBOX["Vercel Sandbox microVM\ndeny-all network · 2 GB · 30s\nno in-process student code"]
    SECRETS["Secrets\nenv vars only — never in code or frontend"]
    LLM["External LLM\nall calls proxied through backend\nno API keys exposed to client"]

    Browser -->|HTTPS| GW
    GW --> AUTH
    AUTH --> SVC
    SVC --> PG
    SVC --> RT
    SVC --> VSBOX
    SVC --> SECRETS
    SVC --> LLM
```

---

## Security Controls

| Control | Implementation |
|---------|---------------|
| Authentication | Supabase Auth — the client signs in (email/password or Google OAuth) and the backend verifies the Supabase access token (HS256, `SUPABASE_JWT_SECRET`); no credentials or refresh tokens stored by the API |
| Authorization | Role-Based Access Control — student / instructor / admin |
| Input validation | Pydantic schemas on all endpoints |
| Rate limiting | slowapi (100 req/min default; Redis backend deferred to Phase 2). The AI Classroom routes carry their own per-user limits (turns 20/min, reads 120/min) via decorators only, with an in-memory store per replica |
| Secrets management | Environment variables only — never in code or committed to git |
| No API keys in frontend | All LLM/API calls proxied through backend |
| Sandboxed code execution | Vercel Sandbox microVM — deny-all network, 2 GB RAM, 30s timeout |
| Resource limits | CPU, Memory, Time limits enforced at microVM level |
| Timeouts | All operations have configurable timeouts |
| Prompt injection protection | Input sanitization, system prompt boundaries |
| RAG source validation | Curated knowledge base only |
| Logging | Structured logs (structlog) — no sensitive data logged |
| SQL injection prevention | Parameterized queries via SQLAlchemy |
| CORS | Configured for known origins only |
| CSRF protection | Standard middleware |

**Never allow the LLM to directly control infrastructure.**

### AI Classroom

- **Ownership**: every classroom route resolves the session by `(id, user_id)`; another user's session is a 404, never 403, so ids cannot be probed. The LangGraph `thread_id` is the server-created session UUID, never client input.
- **Agent output is untrusted**: whiteboard actions pass a strict Pydantic schema before they are stored or published (closed gate catalog, qubit range, size caps, no HTML, entities, URLs or dangerous LaTeX commands). Circuits are additionally checked by `QuantumBackend.validate`. Nothing the model writes is executed; circuits are drawn, not run.
- **Prompt injection**: retrieved text, history and board digests are passed as delimited data blocks the system prompt tells the model to ignore as instructions; agents have no tools and cannot write the learner profile.
- **Bounded input and cost**: messages <= 2,000 characters, bounded context assembly, at most 4 LLM calls and 1 retry per turn, per-user rate limits, and a single active run per session (new turn supersedes, late events rejected).
- **Errors**: the client only sees a generic `TURN_FAILED` message; exception text stays in the logs.
- **Realtime channel secrecy (known limitation)**: `classroom:{session_id}` is a *public* Supabase Realtime channel (a public broadcast only reaches public channels); the unguessable session UUID is the only secret, so anyone who learns it can listen. Events contain no secrets or PII, only lesson text and board objects. Follow-up: switch to private channels with RLS policies on `realtime.messages` and authenticated subscriptions.
- **Checkpoint tables** (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`) are created by LangGraph in `public`; RLS is enabled on them at startup (no policies, service role only). They hold conversation state, so keep PostgREST exposure of `public` closed.

---

## Auth Flow

Sign-in and token lifecycle are owned by **Supabase Auth** on the client
(`hooks/useAuth.ts`, `@supabase/supabase-js`); the API never issues tokens.

```
Client (email/password or Google OAuth)
  → supabase.auth.sign-in → Supabase issues access_token (JWT, HS256)
  → client sends Authorization: Bearer <access_token>

Backend (every authenticated request)
  → verify access_token with SUPABASE_JWT_SECRET (aud "authenticated")
  → _sync_user(): upsert public.users row keyed by token `sub`
    (owns role; provisions on first request, any provider)

GET /api/v1/auth/me   → returns the synced local profile
```

Only `GET /api/v1/auth/me` remains — there are no `login` / `register` /
`refresh` API endpoints.

## RBAC Roles

| Role | Scope |
|------|-------|
| `student` | Own data — courses, circuits, quizzes, progress, tutor |
| `instructor` | Student scope + class management, student analytics, assignments |
| `admin` | All permissions + user management, course management, system config |
