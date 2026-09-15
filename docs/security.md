# Security Architecture

---

## Architecture

```mermaid
flowchart TD
    Browser["Browser\nHTTPS only"]
    GW["API Gateway\nCORS · Rate Limiting · Pydantic Validation · Structlog"]
    AUTH["Auth / RBAC\nJWT 15min · Refresh 7d HttpOnly\nstudent / instructor / admin"]
    SVC["Application Services\nAuth · Learning · Quantum · Agents · RAG · Analytics · ..."]
    PG["PostgreSQL + pgvector\nSQLAlchemy parameterized queries\nAlembic migrations"]
    RT["Supabase Realtime\nWebSocket pub/sub broker"]
    VSBOX["Vercel Sandbox microVM\ndeny-all network · 512 MB · 30s\nno in-process student code"]
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
| Authentication | JWT access tokens (15 min) + refresh tokens (7 days, HttpOnly cookie) |
| Authorization | Role-Based Access Control — student / instructor / admin |
| Input validation | Pydantic schemas on all endpoints |
| Rate limiting | slowapi (100 req/min default; Redis backend deferred to Phase 2) |
| Secrets management | Environment variables only — never in code or committed to git |
| No API keys in frontend | All LLM/API calls proxied through backend |
| Sandboxed code execution | Vercel Sandbox microVM — deny-all network, 512 MB RAM, 30s timeout |
| Resource limits | CPU, Memory, Time limits enforced at microVM level |
| Timeouts | All operations have configurable timeouts |
| Prompt injection protection | Input sanitization, system prompt boundaries |
| RAG source validation | Curated knowledge base only |
| Logging | Structured logs (structlog) — no sensitive data logged |
| SQL injection prevention | Parameterized queries via SQLAlchemy |
| CORS | Configured for known origins only |
| CSRF protection | Standard middleware |

**Never allow the LLM to directly control infrastructure.**

---

## Auth Flow

```
POST /api/v1/auth/login
  → verify bcrypt hash
  → issue access_token (JWT, 15 min, Authorization: Bearer)
  → issue refresh_token (JWT, 7 days, HttpOnly cookie)

POST /api/v1/auth/refresh
  → verify refresh_token (one-time use, rotated on each refresh)
  → issue new access_token + refresh_token
```

## RBAC Roles

| Role | Scope |
|------|-------|
| `student` | Own data — courses, circuits, quizzes, progress, tutor |
| `instructor` | Student scope + class management, student analytics, assignments |
| `admin` | All permissions + user management, course management, system config |
