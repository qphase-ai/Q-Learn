# Data Flow

Eight key flows through the Q-Learn platform.

```mermaid
sequenceDiagram
    participant FE as Frontend (Vercel)
    participant API as FastAPI (Railway)
    participant VM as Vercel Sandbox microVM
    participant DB as Supabase PostgreSQL
    participant RT as Supabase Realtime
    participant LLM as LLM Provider

    Note over FE,API: 1 — User interaction (REST)
    FE->>API: HTTPS REST request

    Note over API,VM: 2 — Circuit simulation
    API->>VM: SandboxRunner.run_python() + Qiskit script
    VM-->>API: JSON (statevector · probabilities · measurements)

    Note over API,VM: 3 — Student code execution
    API->>VM: SandboxRunner.run_python() + student Python
    VM-->>API: stdout / stderr

    Note over API,RT: 4 — Publish real-time event
    API->>RT: channel(circuit:{id}).send(result)
    API->>RT: channel(tutor:{id}).send(token)

    Note over RT,FE: 5 — Frontend subscribes (no FastAPI ws://)
    RT-->>FE: broadcast event via Supabase JS SDK

    Note over API,LLM: 6 — LLM inference
    API->>LLM: prompt (agent / RAG)
    LLM-->>API: completion + citations

    Note over API,FE: 7 — Stream answer to student
    API->>RT: publish tokens to tutor:{session_id}
    RT-->>FE: token stream → rendered in AI Tutor panel
```

## Flow Descriptions

| # | Flow | Transport |
|---|------|-----------|
| 1 | Frontend → API Gateway | HTTPS REST |
| 2 | Backend → Vercel Sandbox (circuit simulation) | Vercel Sandbox SDK — `SandboxRunner.run_python()` |
| 3 | Backend → Vercel Sandbox (student code) | Vercel Sandbox SDK — `SandboxRunner.run_python()` |
| 4 | Backend → Supabase Realtime (publish) | Supabase Python client — channel broadcast |
| 5 | Supabase Realtime → Frontend (subscribe) | Supabase JS SDK WebSocket |
| 6 | Backend → LLM Provider | HTTPS via ChatLiteLLM — primary model first, fallbacks on failure |
| 7 | LLM tokens → Frontend | LLM → API → Supabase Realtime → Frontend |

## AI Classroom turn (flow 8)

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI
    participant DB as PostgreSQL
    participant RT as Supabase Realtime
    participant G as Classroom graph (LangGraph)

    FE->>RT: subscribe classroom:{session_id}
    FE->>API: POST /classroom/sessions/{id}/turns {message, client_message_id}
    API->>DB: lock session row, insert user message (idempotent), set active_run_id + lease
    API-->>FE: 202 {turn_id}
    API->>G: run_turn() background task, thread_id = session_id
    G->>RT: agent.status, message.delta (batched ~100 ms, not durable)
    G->>DB: whiteboard action: UPDATE … WHERE active_run_id = run RETURNING last_event_seq, INSERT event, snapshot at boundaries
    DB-->>G: sequence_no (no row = superseded, run stops)
    G->>RT: whiteboard.action (sequence_no)
    G->>DB: assistant message, status completed, final snapshot
    G->>RT: message.completed
    FE->>API: GET /classroom/sessions/{id}/state?after_seq=N (reload, gap repair)
```

Durable events are written to Postgres first and published second, so anything a client sees live can be replayed. A newer turn or `interrupt` moves `active_run_id`, which makes the old run's next event write fail; it stops without publishing. Channels are public Realtime channels keyed by the unguessable session UUID (see `docs/security.md`).
