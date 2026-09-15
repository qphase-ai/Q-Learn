# AI Agent Architecture

> Implementation detail: [`backend/design.md § AI Agent Backend`](../backend/design.md)

---

## Agent Topology

```mermaid
flowchart TD
    ORCH["Learning Orchestrator\nCoordinator · intent routing · context builder"]

    ORCH --> TUTOR["Tutor Agent\nadaptive explanation · confusion detection"]
    ORCH --> CIRCUIT["Circuit Agent\ngeneration · validation · explanation"]
    ORCH --> QUIZ["Quiz Agent\ndynamic generation · adaptive difficulty"]
    ORCH --> EVAL["Evaluation Agent\nanswer scoring · BKT updates"]
    ORCH --> REC["Recommendation Agent\nmastery analysis · next activity"]
    ORCH --> RESEARCH["Research Agent\nRAG retrieval · citations · source validation"]

    subgraph TOOLS["Shared Tool Layer"]
        direction LR
        T1["RAG Retrieval"]
        T2["Quantum Exec"]
        T3["Code Sandbox"]
        T4["Learning Data"]
    end

    TUTOR --> TOOLS
    CIRCUIT --> TOOLS
    QUIZ --> TOOLS
    EVAL --> TOOLS
    REC --> TOOLS
    RESEARCH --> TOOLS
```

---

## Agent Responsibilities

| Agent | Key Responsibility |
|-------|--------------------|
| **Orchestrator** | Central coordinator, intent understanding, agent selection |
| **Tutor** | Adaptive concept explanation, confusion detection |
| **Circuit** | Circuit generation, validation, explanation, error detection |
| **Quiz** | Dynamic question generation, adaptive difficulty |
| **Evaluation** | Answer/circuit/code evaluation, misconception detection, BKT updates |
| **Recommendation** | Mastery analysis, weak concept identification, next activity |
| **Research** | Reliable information retrieval, citations, source validation |

Teaching progression (Tutor Agent): **Concept → Intuition → Mathematics → Circuit → Code → Simulation → Practice**

---

## Communication Flow

```mermaid
sequenceDiagram
    participant S as Student
    participant O as Orchestrator
    participant A as Agent(s)
    participant E as Evaluation Agent
    participant R as Recommendation Agent
    participant DB as PostgreSQL (AsyncPostgresSaver)

    S->>O: Submit input (question / circuit / code)
    O->>DB: Load learner profile + checkpoint
    O->>O: Build context (skills, history, active lesson)
    O->>A: Delegate to appropriate agent
    A->>A: Execute task using Shared Tool Layer
    A-->>O: AgentResponse
    O->>E: Evaluate answer / update mastery
    E->>DB: Write SkillMastery (BKT)
    O->>R: Get next activity recommendation
    R-->>O: Recommended activity
    O->>DB: Checkpoint agent state
    O-->>S: Response + recommendations
```

---

## State Persistence

Agent session state is checkpointed using **`AsyncPostgresSaver`** (LangGraph). Checkpoints are stored in Supabase PostgreSQL, not in-memory.

- State survives API restarts
- Works correctly across multiple API replicas (stateless FastAPI)
- Session history is queryable from `agent_sessions` / `agent_messages` tables

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
app = workflow.compile(checkpointer=checkpointer)
```
