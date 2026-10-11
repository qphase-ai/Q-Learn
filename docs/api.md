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
| `/api/v1/classroom/*` | AI Classroom (see below) |
| `/api/v1/internal/*` | Server-to-server calls from the Payload CMS, authenticated with `X-CMS-Secret` (not a user JWT). `POST /internal/content-refs` `{kind, payload_id, ref_id?}` returns the lesson's `content_refs` row, minting it on first publish or binding a `legacy:<uuid>` ref when `ref_id` is given. Returns 403 when `CMS_WEBHOOK_SECRET` is unset |

---

## AI Classroom (`/api/v1/classroom`)

All routes need a user JWT and use the standard envelope. Another user's session is always **404**. Routes are rate limited per user with slowapi (this router only): turns/interrupt `20/minute`, create `10/minute`, reads `120/minute` (`CLASSROOM_RATE_LIMIT_*`); a limited call returns 429 with `error.code = RATE_LIMITED`.

| Route | Body / query | Response |
|-------|--------------|----------|
| `POST /sessions` | none | 201 `{session_id}` |
| `POST /sessions/{id}/turns` | `{message (1-2000 chars), client_message_id (uuid)}` | 202 `{turn_id}`. Idempotent on `client_message_id`: a retry returns the original `turn_id` and starts nothing. A turn sent while another runs supersedes it |
| `POST /sessions/{id}/interrupt` | none | `{interrupted: bool}` |
| `GET /sessions/{id}` | none | `{status, messages: [{id, role, content, created_at}]}` |
| `GET /sessions/{id}/state?after_seq=N` | `after_seq >= 0` (default 0) | `{status, snapshot: {board_state, last_sequence_no} \| null, events: [envelope]}` |

`status` is `idle`, `running`, `completed` or `failed`. `/state` semantics: if a snapshot newer than `after_seq` exists it is returned and `events` are those after the snapshot (replace the board, then apply them); otherwise `snapshot` is null and `events` are those with `sequence_no > after_seq` (gap repair). At most 1,000 events per call.

Realtime: the answer streams on broadcast channel `classroom:{session_id}`, single event name `classroom`, envelope `{schema_version: 1, event_id, session_id, turn_id, sequence_no \| null, type, step_id \| null, payload}`:

| `type` | `payload` | Durable |
|--------|-----------|---------|
| `agent.status` | `{label}` | no |
| `message.delta` | `{text}` (batched ~100 ms) | no, `sequence_no` null |
| `message.completed` | `{message_id, content}` | no (the message is in `GET /sessions/{id}`) |
| `whiteboard.action` | `{action, ...}` | yes, `sequence_no` set, replayable via `/state` |
| `classroom.error` | `{code, message}` | no |

`whiteboard.action` actions: `step_started{title}`, `draw_quantum_circuit{object_id, qubits 1-8, gates<=64}`, `render_equation{object_id, latex<=500}`, `draw_annotation{object_id, text<=200, target_id?}`, `highlight_object{object_id}`, `clear_annotation{object_id}`, `step_completed{}`, `tutor_error{message}`. Gate types are limited to the frontend catalog (H X Y Z S T I RX RY RZ U P SX U3 CX CZ SWAP RXX RYY RZZ M). Board reducer: `apply_event` in `app/schemas/whiteboard.py`.

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
