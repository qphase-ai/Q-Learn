# Data Flow

Seven key flows through the Q-Learn platform.

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
    API->>VM: AsyncSandbox.fork() + Qiskit script
    VM-->>API: JSON (statevector · probabilities · measurements)

    Note over API,VM: 3 — Student code execution
    API->>VM: AsyncSandbox.fork() + student Python
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
| 2 | Backend → Vercel Sandbox (circuit simulation) | Vercel Sandbox SDK — `AsyncSandbox.fork()` |
| 3 | Backend → Vercel Sandbox (student code) | Vercel Sandbox SDK — `AsyncSandbox.fork()` |
| 4 | Backend → Supabase Realtime (publish) | Supabase Python client — channel broadcast |
| 5 | Supabase Realtime → Frontend (subscribe) | Supabase JS SDK WebSocket |
| 6 | Backend → LLM Provider | HTTPS via ChatLiteLLM — primary model first, fallbacks on failure |
| 7 | LLM tokens → Frontend | LLM → API → Supabase Realtime → Frontend |
