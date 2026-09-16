# API Boundaries

> Full route reference with request/response schemas: [`backend/design.md § API Routes Reference`](../backend/design.md)

---

## API Groups

| Prefix | Domain |
|--------|--------|
| `/api/v1/auth/*` | Current-user profile (`GET /me`). Sign-up / sign-in / refresh are handled by Supabase Auth on the client, not the API |
| `/api/v1/users/*` | Profile management, role management |
| `/api/v1/courses/*` | Course CRUD, listing, enrollment |
| `/api/v1/lessons/*` | Lesson access, progress tracking |
| `/api/v1/learning/*` | Learning paths, curriculum navigation |
| `/api/v1/skills/*` | Skill mastery queries and updates |
| `/api/v1/circuits/*` | Circuit creation, validation, history |
| `/api/v1/simulations/*` | Circuit execution, state/probability results |
| `/api/v1/quizzes/*` | Quiz generation, attempts, scoring |
| `/api/v1/challenges/*` | Coding challenges, submissions |
| `/api/v1/agents/*` | Agent interactions, conversations |
| `/api/v1/knowledge/*` | RAG search, document management |
| `/api/v1/analytics/*` | Learning analytics, progress data |
| `/api/v1/instructors/*` | Class management, student monitoring |
| `/api/v1/admin/*` | User management, course management, system health |

---

## Response Format

All endpoints return a consistent wrapper:

```json
{ "success": true, "data": { ... }, "message": "OK" }
```

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

Paginated:

```json
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 150, "has_more": true } }
```

---

## Design Rules

- Use **Pydantic** request/response schemas on all endpoints
- Never expose SQLAlchemy ORM models directly as public API contracts
- Keep API schemas in `app/schemas/` — separate from `app/models/`
- Use service → repository architecture; routers stay thin
- Versioning via URL path: `/api/v1/`
- Pagination: cursor-based for list endpoints
