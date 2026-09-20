# Q-Learn — Backend & API Design

## Overview

This document describes the backend architecture, API design, service layer, database schema, authentication, quantum execution layer, RAG pipeline, and infrastructure for Q-Learn. The backend is built with Python 3.11+, FastAPI, SQLAlchemy 2.x, and Alembic.

**Production Infrastructure:** Supabase (Auth, PostgreSQL + pgvector, Storage, Realtime) + Railway (FastAPI backend, Free tier) + Vercel (frontend + Sandbox for isolated student code execution)

> **Architecture is portable.** FastAPI/worker services run in Docker containers and can be deployed to Railway, Fly.io, any VPS, or cloud provider without redesigning Q-Learn. If Railway becomes insufficient, move the service — not the architecture.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [API Design Principles](#api-design-principles)
- [API Routes Reference](#api-routes-reference)
- [Authentication & Authorization](#authentication--authorization)
- [Service Layer](#service-layer)
- [Database Schema](#database-schema)
- [Quantum Execution Backend](#quantum-execution-backend)
- [RAG Pipeline Backend](#rag-pipeline-backend)
- [AI Agent Backend](#ai-agent-backend)
- [Code Execution Sandbox](#code-execution-sandbox)
- [Background Tasks & Queues](#background-tasks--queues)
- [WebSocket Communication](#websocket-communication)
- [Caching Strategy](#caching-strategy)
- [Error Handling](#error-handling)
- [Logging & Observability](#logging--observability)
- [Configuration Management](#configuration-management)
- [Deployment](#deployment)

---

## Architecture Overview

### Microservices Structure

```mermaid
flowchart TD
    subgraph PRESENTATION["🖥️ PRESENTATION LAYER — Vercel (Next.js + React)"]
        direction LR
        Home["Marketing Home\n(public, unauthenticated)"]
        Auth["Auth Pages"]
        Dashboard["Student Dashboard"]
        CircuitUI["Circuit Builder\n(React Flow)"]
        Quiz["Quiz & Challenges"]
        Lesson["Lesson Reader"]
        Sim["Simulation &\nVisualization"]
        Instructor["Instructor /\nAdmin"]
    end

    subgraph APPLICATION["⚙️ APPLICATION LAYER — Railway (FastAPI + Python)"]
        direction TB
        GW["API Gateway\nAuth • Rate Limit • Validation • Routing • Logging"]

        subgraph SERVICES["Services"]
            direction LR
            AuthSvc["Auth\nService"]
            LearnSvc["Learning\nService"]
            CircuitSvc["Circuit\nService"]
            AssessSvc["Assessment\nService"]
            QuantumSvc["Quantum\nExecution"]
            AgentSvc["AI / Agent\nService"]
            RAGSvc["RAG\nService"]
            RecSvc["Recommendation\nService"]
            Analytics["Analytics\nService"]
        end

        GW --> SERVICES
    end

    subgraph DATA["🗄️ DATA & INFRASTRUCTURE LAYER"]
        direction LR
        subgraph Supabase["Supabase"]
            DB["PostgreSQL\n+ pgvector"]
            SupaAuth["Auth"]
            Storage["Storage"]
            Realtime["Realtime\n(WebSocket)"]
        end

        subgraph VercelSandbox["Vercel Sandbox (Hobby)"]
            MicroVM["Isolated microVM\npython3.13 • deny-all network"]
        end

        subgraph External["External"]
            Quantum["Quantum Backend\nQiskit Aer → PennyLane → Cirq"]
            LLM["LLM Provider\nChatLiteLLM — primary + fallbacks\nOpenAI · Anthropic · Gemini · Ollama"]
            KnowledgeBase["Knowledge Sources\nDocs • Papers • Course Material"]
        end
    end

    PRESENTATION -- "HTTPS / REST" --> APPLICATION
    APPLICATION --> DATA
    AgentSvc -- "SDK call" --> MicroVM
    QuantumSvc --> Quantum
    RAGSvc --> LLM
    RAGSvc --> KnowledgeBase
    RAGSvc --> DB
```

---

## API Design Principles

### RESTful Design

1. **Resource-based URLs** — `/api/v1/{resource}/{id}`
2. **HTTP methods** — GET (read), POST (create), PUT/PATCH (update), DELETE (remove)
3. **Stateless** — Each request contains all necessary context (JWT token)
4. **JSON responses** — Consistent response format for all endpoints
5. **Pagination** — Cursor-based pagination for list endpoints
6. **Filtering & Sorting** — Query parameters for all list endpoints
7. **Versioning** — URL path versioning (`/api/v1/`)

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "has_more": true
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Email is required" }
    ]
  }
}
```

### Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Resource created |
| 204 | Success, no content |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 422 | Validation error (FastAPI) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## API Routes Reference

### Authentication

```
POST   /api/v1/auth/register          — Register new user
POST   /api/v1/auth/login             — Login, return JWT tokens
POST   /api/v1/auth/logout            — Invalidate session
POST   /api/v1/auth/refresh           — Refresh access token
POST   /api/v1/auth/forgot-password   — Send password reset email
POST   /api/v1/auth/reset-password    — Reset password with token
GET    /api/v1/auth/me                — Get current user profile
PUT    /api/v1/auth/profile           — Update profile
```

### Users

```
GET    /api/v1/users/                 — List users (admin)
GET    /api/v1/users/{id}             — Get user profile
PUT    /api/v1/users/{id}             — Update user
DELETE /api/v1/users/{id}             — Delete user (admin)
GET    /api/v1/users/{id}/progress    — Get user progress
GET    /api/v1/users/{id}/mastery     — Get skill mastery
```

### Courses & Curriculum

```
GET    /api/v1/courses/               — List all courses
GET    /api/v1/courses/{id}           — Get course details
GET    /api/v1/courses/{id}/modules   — Get course modules
GET    /api/v1/modules/{id}           — Get module details
GET    /api/v1/modules/{id}/lessons   — Get module lessons
GET    /api/v1/lessons/{id}           — Get lesson content
GET    /api/v1/lessons/{id}/progress  — Get lesson progress
PUT    /api/v1/lessons/{id}/progress  — Update lesson progress
```

### Learning

```
GET    /api/v1/learning/path          — Get personalized learning path
GET    /api/v1/learning/next          — Get next recommended activity
GET    /api/v1/learning/overview      — Get learning overview
POST   /api/v1/learning/assessment    — Submit initial assessment
GET    /api/v1/learning/skills        — Get all skill mastery scores
PUT    /api/v1/learning/skills/{id}   — Update skill mastery
```

### Circuits

```
POST   /api/v1/circuits/              — Create new circuit
GET    /api/v1/circuits/              — List user circuits
GET    /api/v1/circuits/{id}          — Get circuit details
PUT    /api/v1/circuits/{id}          — Update circuit
DELETE /api/v1/circuits/{id}          — Delete circuit
POST   /api/v1/circuits/{id}/validate — Validate circuit
POST   /api/v1/circuits/{id}/execute  — Execute circuit simulation
POST   /api/v1/circuits/{id}/export   — Export circuit (JSON/OpenQASM)
GET    /api/v1/circuits/{id}/results  — Get execution results
```

### Simulation

```
POST   /api/v1/simulations/execute    — Execute quantum circuit
POST   /api/v1/simulations/statevector — Get state vector
POST   /api/v1/simulations/probabilities — Get probability distribution
POST   /api/v1/simulations/measurements — Get measurement results
GET    /api/v1/simulations/{id}/status — Check execution status
```

### Quizzes

```
GET    /api/v1/quizzes/               — List available quizzes
GET    /api/v1/quizzes/{id}           — Get quiz details
POST   /api/v1/quizzes/{id}/start     — Start quiz
POST   /api/v1/quizzes/{id}/submit    — Submit quiz answers
GET    /api/v1/quizzes/{id}/results   — Get quiz results
POST   /api/v1/quizzes/generate       — Generate new quiz
```

### Coding Challenges

```
GET    /api/v1/challenges/            — List available challenges
GET    /api/v1/challenges/{id}        — Get challenge details
POST   /api/v1/challenges/{id}/submit — Submit solution code
GET    /api/v1/challenges/{id}/result — Get challenge result
POST   /api/v1/challenges/generate    — Generate new challenge
```

### AI Agent / Tutor

```
POST   /api/v1/agents/chat            — Send message to AI tutor
POST   /api/v1/agents/circuit-explain — Explain a circuit
POST   /api/v1/agents/assess          — Get assessment feedback
POST   /api/v1/agents/quiz-generate   — Generate quiz questions
POST   /api/v1/agents/recommend       — Get recommendations
POST   /api/v1/agents/research        — Research query
GET    /api/v1/agents/sessions/{id}   — Get agent session history
```

### RAG / Knowledge

```
GET    /api/v1/knowledge/search       — Search knowledge base
POST   /api/v1/knowledge/documents    — Upload document
GET    /api/v1/knowledge/documents    — List documents
DELETE /api/v1/knowledge/documents/{id} — Delete document
GET    /api/v1/knowledge/stats        — Get knowledge base stats
```

### Analytics

```
GET    /api/v1/analytics/learning     — Learning analytics
GET    /api/v1/analytics/user/{id}    — User analytics
GET    /api/v1/analytics/class/{id}   — Class analytics
GET    /api/v1/analytics/system       — System metrics
GET    /api/v1/analytics/activity     — Activity feed
```

### Instructor

```
GET    /api/v1/instructor/classes     — List classes
GET    /api/v1/instructor/classes/{id} — Get class details
POST   /api/v1/instructor/classes     — Create class
PUT    /api/v1/instructor/classes/{id} — Update class
GET    /api/v1/instructor/classes/{id}/students — Class students
GET    /api/v1/instructor/classes/{id}/analytics — Class analytics
POST   /api/v1/instructor/assignments — Create assignment
GET    /api/v1/instructor/assignments — List assignments
```

### Admin

```
GET    /api/v1/admin/users            — List all users
GET    /api/v1/admin/users/{id}       — Get user details
PUT    /api/v1/admin/users/{id}       — Update user
DELETE /api/v1/admin/users/{id}       — Delete user
GET    /api/v1/admin/courses          — List all courses
POST   /api/v1/admin/courses          — Create course
PUT    /api/v1/admin/courses/{id}     — Update course
GET    /api/v1/admin/analytics        — Platform analytics
GET    /api/v1/admin/system           — System health
```

---

## Authentication & Authorization

### JWT Token System

```
Login → Verify credentials → Return access_token + refresh_token
```

**Access Token:**
- Expires in 15 minutes
- Sent in `Authorization: Bearer {token}` header
- Contains: `user_id`, `role`, `permissions`

**Refresh Token:**
- Expires in 7 days
- Stored in HttpOnly cookie
- Used to obtain new access token

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **student** | Read courses, build circuits, take quizzes, view own analytics |
| **instructor** | All student permissions + create classes, view student analytics, assign activities |
| **admin** | All permissions + manage users, courses, system configuration |

**Authorization Middleware:**
```python
def require_role(*roles: str):
    """Decorator to enforce role-based access."""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request):
            user = await get_current_user(request)
            if user.role not in roles:
                raise HTTPException(status_code=403, detail="Forbidden")
            return await func(request, user=user)
        return wrapper
    return decorator
```

### Password Security

- **Hashing**: bcrypt (via passlib)
- **Minimum length**: 8 characters
- **Complexity**: At least one uppercase, one lowercase, one number
- **Rate limiting**: 5 attempts per 15 minutes on login
- **Refresh rotation**: Each refresh token can only be used once

---

## Service Layer

### Architecture

```
API Router → Service → Repository → Database
              ↓
          External Services (LLM, Quantum, Sandbox)
```

Each service encapsulates business logic and is independent of the API layer.

### Service Directory Structure

```
app/
├── services/
│   ├── auth_service.py          — User registration, login, JWT management
│   ├── user_service.py          — Profile management, role updates
│   ├── learning_service.py      — Course/module/lesson management, progress tracking
│   ├── circuit_service.py       — Circuit CRUD, validation, analysis
│   ├── quantum_execution_service.py — Backend abstraction, job management, result processing
│   ├── assessment_service.py    — Quiz generation, answer evaluation, feedback
│   ├── rag_service.py           — Document ingestion, search, retrieval pipeline
│   ├── recommendation_service.py — Learning path generation, skill gap analysis
│   ├── analytics_service.py     — Learning analytics, user metrics, class analytics
│   ├── content_service.py       — Content management, file handling, versioning
│   └── notification_service.py  — In-app notifications, emails, event triggers
```

### Service Pattern

```python
class CircuitService:
    """Service for circuit operations."""

    def __init__(self, circuit_repo: CircuitRepository, quantum_service: QuantumExecutionService):
        self.circuit_repo = circuit_repo
        self.quantum_service = quantum_service

    async def create(self, user_id: uuid, circuit_data: CircuitCreate) -> Circuit:
        """Create a new circuit for a user."""
        circuit = Circuit(user_id=user_id, **circuit_data.model_dump())
        await self.circuit_repo.create(circuit)
        return circuit

    async def execute(self, circuit_id: uuid) -> ExecutionResult:
        """Execute a circuit through the quantum backend."""
        circuit = await self.circuit_repo.get(circuit_id)
        validation = await self.validate(circuit)
        if not validation.is_valid:
            raise ValidationError(details=validation.errors)
        result = await self.quantum_service.execute(circuit.definition)
        await self.circuit_repo.store_execution(circuit_id, result)
        return result

    async def validate(self, circuit: Circuit) -> ValidationResult:
        """Validate circuit structure and gate compatibility."""
        # Deterministic validation logic
        ...
```

---

## Database Schema

### Core Models (SQLAlchemy 2.x)

#### User Model
```python
class User(Base):
    __tablename__ = "users"
    id = Column(UUID, primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")  # student, instructor, admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UserProfile(Base):
    __tablename__ = "user_profiles"
    user_id = Column(UUID, ForeignKey("users.id"), primary_key=True)
    display_name = Column(String(100))
    skill_level = Column(String(20), default="beginner")
    preferences = Column(JSON, default={})
    avatar_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

#### Course & Learning Models
```python
class Course(Base):
    __tablename__ = "courses"
    id = Column(UUID, primary_key=True, default=uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="published")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Module(Base):
    __tablename__ = "modules"
    id = Column(UUID, primary_key=True, default=uuid4)
    course_id = Column(UUID, ForeignKey("courses.id"), nullable=False)
    title = Column(String(200), nullable=False)
    position = Column(Integer, nullable=False)

class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(UUID, primary_key=True, default=uuid4)
    module_id = Column(UUID, ForeignKey("modules.id"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)  # Markdown or JSON
    position = Column(Integer, nullable=False)
    difficulty = Column(String(20), default="beginner")

class Concept(Base):
    __tablename__ = "concepts"
    id = Column(UUID, primary_key=True, default=uuid4)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    difficulty = Column(String(20), nullable=False)
    prerequisites = Column(JSON)  # List of concept IDs
```

#### Student Progress & Mastery Models
```python
class LearningProgress(Base):
    __tablename__ = "learning_progress"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(UUID, ForeignKey("lessons.id"), nullable=False)
    status = Column(String(20), default="not_started")  # not_started, in_progress, completed
    completion = Column(Float, default=0.0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

class SkillMastery(Base):
    __tablename__ = "skill_mastery"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    concept_id = Column(UUID, ForeignKey("concepts.id"), nullable=False)
    mastery_score = Column(Float, default=0.0)  # 0.0 to 1.0
    confidence = Column(Float, default=0.5)
    attempt_count = Column(Integer, default=0)
    last_attempt = Column(DateTime(timezone=True))
    recent_performance = Column(JSON)  # Last 10 results
    common_errors = Column(JSON)  # Frequently made mistakes
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

#### Circuit Models
```python
class Circuit(Base):
    __tablename__ = "circuits"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    name = Column(String(200))
    definition = Column(JSON, nullable=False)  # Framework-independent JSON
    backend = Column(String(20), default="qiskit_aer")
    is_shared = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class CircuitExecution(Base):
    __tablename__ = "circuit_executions"
    id = Column(UUID, primary_key=True, default=uuid4)
    circuit_id = Column(UUID, ForeignKey("circuits.id"), nullable=False)
    backend = Column(String(20))
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    circuit_definition = Column(JSON)
    statevector = Column(JSON)  # Complex amplitudes
    probabilities = Column(JSON)  # Measurement probabilities
    measurements = Column(JSON)  # Shot results
    execution_time = Column(Float)  # Seconds
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

#### Quiz & Challenge Models
```python
class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(UUID, primary_key=True, default=uuid4)
    lesson_id = Column(UUID, ForeignKey("lessons.id"))
    title = Column(String(200), nullable=False)
    difficulty = Column(String(20), default="medium")
    time_limit = Column(Integer)  # Minutes, null = no limit
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(UUID, primary_key=True, default=uuid4)
    quiz_id = Column(UUID, ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), nullable=False)  # multiple_choice, prediction, code_completion
    answer_data = Column(JSON, nullable=False)
    difficulty = Column(String(20), default="medium")
    explanation = Column(Text)
    position = Column(Integer)

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    question_id = Column(UUID, ForeignKey("quiz_questions.id"), nullable=False)
    answer = Column(JSON)
    is_correct = Column(Boolean)
    score = Column(Float)
    time_taken = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CodingChallenge(Base):
    __tablename__ = "coding_challenges"
    id = Column(UUID, primary_key=True, default=uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    difficulty = Column(String(20), default="medium")
    expected_result = Column(JSON, nullable=False)  # Expected circuit or output
    starter_code = Column(Text)
    hints = Column(JSON)
    is_active = Column(Boolean, default=True)

class ChallengeAttempt(Base):
    __tablename__ = "challenge_attempts"
    id = Column(UUID, primary_key=True, default=uuid4)
    challenge_id = Column(UUID, ForeignKey("coding_challenges.id"), nullable=False)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    submitted_code = Column(Text)
    result = Column(JSON)
    score = Column(Float)
    feedback = Column(Text)
    execution_log = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

#### RAG & Knowledge Models
```python
class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"
    id = Column(UUID, primary_key=True, default=uuid4)
    title = Column(String(500), nullable=False)
    source_url = Column(String(1000))
    source_type = Column(String(50))  # textbook, documentation, paper, course_material
    author = Column(String(200))
    version = Column(String(50))
    publication_date = Column(DateTime)
    file_path = Column(String(500))
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(UUID, primary_key=True, default=uuid4)
    document_id = Column(UUID, ForeignKey("knowledge_documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    metadata = Column(JSON, default={})
    chunk_index = Column(Integer, nullable=False)
    token_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class KnowledgeEmbedding(Base):
    __tablename__ = "knowledge_embeddings"
    id = Column(UUID, primary_key=True, default=uuid4)
    chunk_id = Column(UUID, ForeignKey("document_chunks.id"), nullable=False)
    embedding = Column(Vector(384))  # pgvector column
    model_name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_embeddings_chunk_id", "chunk_id"),
        Index("ix_embedding_search", "embedding", postgresql_using="ivfflat"),
    )
```

#### Agent Models
```python
class AgentSession(Base):
    __tablename__ = "agent_sessions"
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    session_type = Column(String(50), nullable=False)  # tutor, circuit_explain, quiz, research
    context = Column(JSON, default={})  # Learning context, skill levels
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AgentMessage(Base):
    __tablename__ = "agent_messages"
    id = Column(UUID, primary_key=True, default=uuid4)
    session_id = Column(UUID, ForeignKey("agent_sessions.id"), nullable=False)
    agent_name = Column(String(50), nullable=False)
    role = Column(String(20), nullable=False)  # system, user, assistant, tool
    content = Column(Text, nullable=False)
    tool_calls = Column(JSON)  # Function calling data
    metadata = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

## Quantum Execution Backend

### QuantumBackend Abstract Interface

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class CircuitSpec:
    qubits: int
    classical_bits: int
    gates: list[dict]

@dataclass
class CompiledCircuit:
    circuit: CircuitSpec
    backend: str
    qasm: str

@dataclass
class ExecutionResult:
    status: str  # success, failed
    statevector: Optional[list[complex]]
    probabilities: dict[str, float]
    measurements: Optional[list[str]]
    execution_time: float
    metadata: dict

@dataclass
class ValidationResult:
    is_valid: bool
    errors: list[str]
    warnings: list[str]

class QuantumBackend(ABC):
    """Abstract interface for all quantum simulators."""

    @abstractmethod
    async def validate(self, circuit: CircuitSpec) -> ValidationResult: ...

    @abstractmethod
    async def compile(self, circuit: CircuitSpec) -> CompiledCircuit: ...

    @abstractmethod
    async def execute(self, circuit: CompiledCircuit, shots: int = 1024) -> ExecutionResult: ...

    @abstractmethod
    async def get_statevector(self, circuit: CompiledCircuit) -> list[complex]: ...

    @abstractmethod
    async def get_probabilities(self, circuit: CompiledCircuit) -> dict[str, float]: ...

    @abstractmethod
    async def get_measurements(self, circuit: CompiledCircuit, shots: int) -> list[str]: ...
```

### Qiskit Aer Adapter — via Vercel Sandbox

Qiskit Aer is CPU-bound. Running it inside the FastAPI process would block the event loop under concurrent load. Instead, `QiskitAerAdapter.execute()` serialises the circuit to a self-contained Python script, forks a Vercel Sandbox microVM (same infrastructure as student code execution), runs the script there, and deserialises the JSON result. FastAPI stays I/O-bound throughout.

**Scaling model:** each circuit execution is an isolated `AsyncSandbox.fork()` call. Vercel manages the microVM pool. 10 concurrent circuit executions = 10 concurrent forks; the API process has no CPU load.

```python
class QiskitAerAdapter(QuantumBackend):
    """Adapter for Qiskit Aer — executes inside a Vercel Sandbox microVM."""

    async def validate(self, circuit: CircuitSpec) -> ValidationResult:
        errors = []
        if circuit.qubits < 1 or circuit.qubits > 29:
            errors.append("qubit count must be 1–29")
        return ValidationResult(is_valid=len(errors) == 0, errors=errors, warnings=[])

    async def compile(self, circuit: CircuitSpec) -> CompiledCircuit:
        qasm = _build_qasm(circuit)  # Pure-Python OpenQASM 2 serialiser, no Qiskit needed locally
        return CompiledCircuit(circuit=circuit, backend="qiskit_aer", qasm=qasm)

    async def execute(self, circuit: CompiledCircuit, shots: int = 1024) -> ExecutionResult:
        """Fork a Vercel Sandbox microVM and run Qiskit Aer there."""
        from vercel_sandbox import AsyncSandbox
        script = _render_qiskit_script(circuit.qasm, shots)  # returns self-contained Python string

        async with await AsyncSandbox.fork(
            source_sandbox=settings.sandbox_base_name,
            network_policy={"mode": "deny-all"},
            resources={"vcpus": "1", "memory": "512"},
            timeout=settings.sandbox_timeout,
        ) as sandbox:
            result = await sandbox.run_command("python", ["-c", script])
            if result.exit_code != 0:
                raise QuantumExecutionError(await result.stderr(), backend="qiskit")
            return _parse_execution_result(await result.stdout())
```

`_render_qiskit_script` builds a Python string that:
1. Imports Qiskit from the pre-installed snapshot
2. Reconstructs the circuit from the embedded QASM
3. Runs `AerSimulator` for statevector + shots
4. Prints a JSON object `{statevector, probabilities, measurements, execution_time}` to stdout

`_parse_execution_result` deserialises that JSON into `ExecutionResult`.

### Adapter Selection

```python
class QuantumExecutionService:
    """Service for managing quantum execution across backends."""

    BACKENDS = {
        "qiskit_aer": QiskitAerAdapter,
        "pennylane": PennyLaneAdapter,  # Phase 2
        "cirq": CirqAdapter,            # Phase 2
    }

    def __init__(self):
        self.adapters: dict[str, QuantumBackend] = {}

    async def get_backend(self, name: str = "qiskit_aer") -> QuantumBackend:
        """Get or create a backend adapter."""
        if name not in self.adapters:
            adapter_class = self.BACKENDS[name]
            self.adapters[name] = adapter_class()
        return self.adapters[name]

    async def execute(self, circuit_spec: CircuitSpec, backend: str = "qiskit_aer", shots: int = 1024) -> ExecutionResult:
        """Execute a circuit through the specified backend."""
        adapter = await self.get_backend(backend)
        compiled = await adapter.compile(circuit_spec)
        result = await adapter.execute(compiled, shots)
        return result
```

---

## RAG Pipeline Backend

### Architecture

```
User Query → Query Rewriting → Hybrid Retrieval → Reranking → LLM Generation → Response
```

### LlamaIndex Integration

```python
class RAGService:
    """Service for RAG-powered knowledge retrieval."""

    def __init__(self, vector_store, embedding_model):
        self.vector_store = vector_store  # PGVectorStore
        self.llm = get_llm()              # ChatLiteLLM with fallback routing
        self.embed_model = embedding_model # Sentence transformers

        # Build query engine at startup
        self.index = self._build_index()
        self.query_engine = self.index.as_query_engine(
            similarity_top_k=12,
            node_postprocessors=[SentenceTransformerRerank(
                model="cross-encoder/ms-marco-MiniLM-L-6-v2",
                top_n=5
            )]
        )

    def _build_index(self):
        """Build the vector index from documents."""
        from llama_index.core import VectorStoreIndex, StorageContext
        from llama_index.vector_stores.pgvector import PGVectorStore

        vector_store = PGVectorStore.from_params(
            host=settings.PGHOST,
            database=settings.PGDATABASE,
            user=settings.PGUSER,
            password=settings.PGPASSWORD,
            table_name="knowledge_embeddings",
            embed_dim=384
        )
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        index = VectorStoreIndex.from_vector_store(vector_store, storage_context=storage_context)
        return index

    async def query(self, question: str, session_context: dict = None) -> RAGResponse:
        """Query the knowledge base with grounding."""
        # Query rewriting if context available
        if session_context and session_context.get("current_lesson"):
            question = self._augment_query(question, session_context)

        # Get response from LlamaIndex query engine
        response = self.query_engine.query(question)

        # Extract sources with citations
        sources = []
        for node in response.source_nodes:
            sources.append({
                "title": node.metadata.get("title"),
                "url": node.metadata.get("source_url"),
                "score": node.score,
                "chunk_index": node.node.chunk_index,
                "text": node.text[:300]
            })

        return RAGResponse(
            answer=str(response.response),
            sources=sources,
            query=question,
            citations_count=len(sources)
        )
```

### Hybrid Search Strategy

```
1. BM25 Search (sparse) — Fast keyword matching
2. Vector Search (dense) — Semantic similarity
3. RRF Fusion — Combine both rankings
4. Cross-Encoder Reranking — Re-rank top results
5. LLM Synthesis — Generate grounded answer
```

### Document Ingestion Pipeline

```python
class DocumentIngestionService:
    """Service for ingesting and processing documents."""

    async def ingest(self, document: KnowledgeDocument) -> IngestionResult:
        """Full ingestion pipeline."""
        # 1. Parse document
        text = await self._parse_document(document.file_path)

        # 2. Split into chunks
        chunks = self._chunk_text(text, chunk_size=800, overlap=120)

        # 3. Generate embeddings
        for i, chunk in enumerate(chunks):
            embedding = await self.embed_model.get_embedding(chunk)
            # Store in pgvector
            await self._store_chunk(document.id, chunk, embedding, i)

        # 4. Update metadata
        document.status = "indexed"
        await self._update_document(document)

        return IngestionResult(chunks_count=len(chunks))
```

---

## AI Agent Backend

### Agent Orchestration with LangGraph

```python
class AgentOrchestratorService:
    """Service for coordinating AI agents via LangGraph."""

    def __init__(self):
        self.orchestrator = self._build_graph()

    def _build_graph(self):
        """Build the LangGraph agent workflow."""
        from langgraph.graph import StateGraph, END
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        # Define states
        class AgentState(TypedDict):
            user_message: str
            learner_profile: dict
            session_context: dict
            orchestrator_decision: dict
            agent_output: dict
            sources: list[dict]

        # Build graph
        workflow = StateGraph(AgentState)

        # Add nodes (agents)
        workflow.add_node("orchestrator", self._orchestrator_node)
        workflow.add_node("tutor", self._tutor_node)
        workflow.add_node("circuit_agent", self._circuit_node)
        workflow.add_node("evaluation", self._evaluation_node)
        workflow.add_node("recommendation", self._recommendation_node)
        workflow.add_node("research", self._research_node)

        # Add edges
        workflow.add_edge("orchestrator", "tutor")  # Or orchestrator routes to appropriate agent
        workflow.add_edge("tutor", "evaluation")
        workflow.add_edge("evaluation", "recommendation")
        workflow.add_edge("recommendation", END)

        # Conditional routing from orchestrator
        workflow.add_conditional_edges("orchestrator", self._route_to_agent)

        # Compile with persistent PostgreSQL checkpointer (survives restarts, works across replicas)
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
        app = workflow.compile(checkpointer=checkpointer)
        return app

    async def process(self, user_message: str, user_id: uuid) -> AgentResponse:
        """Process a user message through the agent system."""
        # Load learner profile
        profile = await self.learning_service.get_profile(user_id)

        # Build initial state
        state = {
            "user_message": user_message,
            "learner_profile": profile,
            "session_context": {},
            "orchestrator_decision": {},
            "agent_output": {},
            "sources": []
        }

        # Execute the graph
        result = await self.orchestrator.ainvoke(state)
        return AgentResponse(
            content=result["agent_output"]["content"],
            sources=result["sources"],
            recommendations=result["agent_output"].get("recommendations", []),
            mastery_updates=result["agent_output"].get("mastery_updates", [])
        )
```

### Agent Prompt Configuration

All agent prompts centralized in `app/agents/prompts.py`:

```python
TUTOR_SYSTEM_PROMPT = """You are the Q-Learn AI Tutor, an expert in quantum computing education.
Your role is to explain quantum concepts at the appropriate level for the student.

Teaching progression: Concept → Intuition → Mathematics → Circuit → Code → Simulation → Practice

Guidelines:
- Always adapt to the student's level
- Use intuition first, then mathematics
- Show circuits and code examples
- Never hallucinate quantum formulas
- Cite sources when using external knowledge
- Use LaTeX notation for math: $ψ⟩ = α|0⟩ + β|1⟩$

Student level: {level}
Current concept: {concept}
"""
```

---

## Code Execution Sandbox

### Architecture

Both **student code execution** and **quantum circuit simulation** go through Vercel Sandbox. This keeps the FastAPI process I/O-bound and lets Vercel manage concurrency for all compute-heavy work.

```
Client → FastAPI → AsyncSandbox.fork() → Vercel microVM (Qiskit pre-installed) → JSON result
```

### Implementation

```python
class SandboxService:
    """Service for secure student code execution via Vercel Sandbox."""

    async def execute(self, user_id: uuid, code: str) -> dict:
        """Execute student code in an isolated Vercel Sandbox microVM."""
        from vercel_sandbox import AsyncSandbox

        async with await AsyncSandbox.fork(
            source_sandbox="qlearn-python-base",  # Pre-built snapshot with Qiskit installed
            network_policy={"mode": "deny-all"},
            resources={"vcpus": "1", "memory": "512"},
            timeout=30000,  # 30 seconds
        ) as sandbox:
            result = await sandbox.run_command("python", ["-c", code])
            return {
                "status": "success" if result.exit_code == 0 else "error",
                "output": await result.stdout(),
                "error": await result.stderr(),
                "exit_code": result.exit_code,
            }
```

### Security Rules

- **Network policy: deny-all** — student code cannot reach the internet
- **Isolated microVM** — fully managed by Vercel, no shared process space
- **Memory limit**: 512MB (configurable)
- **Timeout**: 30 seconds
- **Qiskit pre-installed** via persistent `qlearn-python-base` snapshot
- **Hobby plan hard quota** — no billing risk, sandbox pauses when quota exhausted

---

## Background Tasks

Background tasks use **FastAPI's built-in `BackgroundTasks`** for lightweight async work. There is no Celery or Redis queue. All compute-heavy work (quantum simulation, student code) is handled asynchronously via the Vercel Sandbox SDK — each execution is a `AsyncSandbox.fork()` call, so FastAPI never does CPU work.

### Key Background Tasks

| Task | Mechanism | Purpose |
|------|-----------|---------|
| `execute_quantum` | Vercel Sandbox SDK (async) | Run Qiskit Aer circuit simulation in isolated microVM |
| `execute_code` | Vercel Sandbox SDK (async) | Run student Python code in isolated microVM |
| `send_notification` | FastAPI BackgroundTasks | Send in-app notifications |
| `generate_analytics` | FastAPI BackgroundTasks | Compute learning analytics |
| `ingest_document` | FastAPI BackgroundTasks | Process uploaded RAG documents |
| `generate_quiz` | FastAPI BackgroundTasks | Generate quiz questions via LLM |
| `evaluate_submission` | FastAPI BackgroundTasks | Evaluate student work via agents |

### Task Status Flow

```
request received → AsyncSandbox.fork() / FastAPI BackgroundTask → result → stored in DB
```

---

## WebSocket Communication

### Use Cases

- **Real-time circuit simulation** — Live updates during execution
- **AI tutor streaming** — Token-by-token response streaming
- **Progress updates** — Real-time skill mastery updates
- **Notifications** — Instant push notifications

### Implementation — Supabase Realtime

Real-time communication uses **Supabase Realtime** rather than FastAPI WebSocket endpoints. This eliminates the multi-replica problem: with direct FastAPI `ws://` endpoints, a client on replica A cannot receive events published by replica B. Supabase Realtime acts as the shared pub/sub broker.

**Pattern:**
1. FastAPI completes an operation (circuit execution, tutor token, progress update)
2. FastAPI publishes an event to a Supabase Realtime channel via the Python SDK
3. The frontend client (subscribed to that channel via Supabase JS SDK) receives the event instantly

```python
# FastAPI publishes — no WebSocket server needed in the API
from supabase import AsyncClient

async def publish_circuit_result(supabase: AsyncClient, circuit_id: str, result: dict):
    await supabase.realtime.channel(f"circuit:{circuit_id}").send(
        type="broadcast",
        event="result",
        payload=result,
    )

async def publish_tutor_token(supabase: AsyncClient, session_id: str, token: str):
    await supabase.realtime.channel(f"tutor:{session_id}").send(
        type="broadcast",
        event="token",
        payload={"token": token},
    )
```

```typescript
// Frontend subscribes — Supabase JS SDK
supabase.channel(`circuit:${circuitId}`)
  .on("broadcast", { event: "result" }, ({ payload }) => setResult(payload))
  .subscribe()

supabase.channel(`tutor:${sessionId}`)
  .on("broadcast", { event: "token" }, ({ payload }) => appendToken(payload.token))
  .subscribe()
```

Supabase Realtime handles connection management, reconnection, and horizontal scaling. The API has no stateful WebSocket connections to maintain.

---

## Caching Strategy

Redis is **not** in the initial stack. Caching is deferred until profiling shows a specific hot path. In-process result caching (e.g. `functools.lru_cache` for static course content) covers early-stage needs without added infrastructure.

When Redis is introduced (Phase 2+), the cache layers will be:

| Layer | TTL | Purpose |
|-------|-----|---------|
| **Response cache** | 5–60 min | Repeated API queries |
| **Vector cache** | 1 hour | Embedding reuse |
| **Circuit result cache** | 1 day | Frequently run circuits |
| **LLM prompt cache** | 1 hour | Repeated prompt → response |

```python
def get_cache_key(pattern: str, **params) -> str:
    sorted_params = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return f"qlearn:cache:{pattern}:{sorted_params}"
```

### Cache Invalidation

- User data changes → Invalidate user-specific caches
- Course content updated → Invalidate course caches
- New knowledge document → Invalidate RAG caches
- Circuit result stored → Cache the execution result

---

## Error Handling

### Error Hierarchy

```python
class QlearnError(Exception):
    """Base exception."""
    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)

class ValidationError(QlearnError):
    def __init__(self, message: str, details: list = None):
        super().__init__(message, "VALIDATION_ERROR", 400)
        self.details = details or []

class AuthenticationError(QlearnError):
    def __init__(self, message: str):
        super().__init__(message, "AUTHENTICATION_ERROR", 401)

class PermissionError(QlearnError):
    def __init__(self, message: str):
        super().__init__(message, "PERMISSION_ERROR", 403)

class NotFoundError(QlearnError):
    def __init__(self, message: str):
        super().__init__(message, "NOT_FOUND", 404)

class RateLimitError(QlearnError):
    def __init__(self, message: str):
        super().__init__(message, "RATE_LIMITED", 429)

class QuantumExecutionError(QlearnError):
    def __init__(self, message: str, backend: str = None):
        super().__init__(message, "QUANTUM_ERROR", 500)
        self.backend = backend

class SandboxError(QlearnError):
    def __init__(self, message: str):
        super().__init__(message, "SANDBOX_ERROR", 500)
```

### Global Exception Handler

```python
@app.exception_handler(QlearnError)
async def qlearn_exception_handler(request: Request, exc: QlearnError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message
            }
        }
    )
```

---

## Logging & Observability

### Structured Logging

```python
import structlog

logger = structlog.get_logger()

# Configuration
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.dev.JSONRenderer()
    ]
)
```

### Agent Tracing

```python
class AgentTracer:
    """Trace agent invocations for debugging and research."""

    async def trace(self, agent_name: str, inputs: dict, outputs: dict):
        logger.info("agent_invocation",
            agent=agent_name,
            latency_ms=outputs.get("latency"),
            tool_calls=outputs.get("tools"),
            retrieval_results=outputs.get("retrieval", {}).get("count"),
            model_latency=outputs.get("model_latency"),
            tokens_used=outputs.get("tokens")
        )
```

### Metrics to Track

| Category | Metrics |
|----------|---------|
| **Agent** | Invocation count, latency, tool calls, model latency, token usage |
| **Quantum** | Execution time, success rate, error types |
| **API** | Request count, response time, error rate |
| **Learning** | Activity count, mastery changes, quiz scores |
| **System** | CPU, memory, database connections, queue depth |

### Integration

- **Prometheus** — Metrics exposition
- **Grafana** — Dashboard visualization
- **Pydantic** — Request/response validation logging
- **Sentry** — Error tracking (production)

---

## Configuration Management

### Environment Variables

```env
# Application
APP_ENV=development
APP_DEBUG=true
SECRET_KEY=your-secret-key
API_BASE_URL=http://localhost:8000

# Supabase (Production)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Development Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/qlearn
DB_POOL_SIZE=20

# Quantum
QUANTUM_BACKEND=qiskit_aer

# AI/LLM — ChatLiteLLM model routing
LLM_PRIMARY_MODEL=gpt-4o-mini
LLM_FALLBACK_MODELS=["anthropic/claude-haiku-4-5-20251001","gemini/gemini-1.5-flash"]
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2048
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=

# RAG
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIM=384
CHUNK_SIZE=800
CHUNK_OVERLAP=120

# Supabase Storage
STORAGE_BACKEND=supabase
SUPABASE_STORAGE_BUCKET=qlearn-uploads

# Security (Vercel)
CORS_ORIGINS=https://your-project.vercel.app
RATE_LIMIT=100
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_DAYS=7

# Vercel Sandbox (student code execution)
VERCEL_TOKEN=your-vercel-token
VERCEL_TEAM_ID=your-team-id
SANDBOX_BASE_NAME=qlearn-python-base
SANDBOX_TIMEOUT=30000
```

> In production, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_ANON_KEY` replace the local PostgreSQL configuration. `VERCEL_TOKEN` enables Sandbox calls. All secrets are managed through environment variables.

### Configuration Loading

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str
    database_url: str
    llm_primary_model: str = "gpt-4o-mini"
    llm_fallback_models: list[str] = ["anthropic/claude-haiku-4-5-20251001", "gemini/gemini-1.5-flash"]
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2048
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384
    chunk_size: int = 800
    chunk_overlap: int = 120
    cors_origins: list[str] = ["http://localhost:3000"]
    rate_limit: int = 100
    vercel_token: str
    vercel_team_id: str = ""
    sandbox_base_name: str = "qlearn-python-base"
    sandbox_timeout: int = 30000

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Deployment

### Docker Compose (Development)

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-pgvector
    environment:
      POSTGRES_DB: qlearn
      POSTGRES_USER: qlearn
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U qlearn"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./apps/api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://qlearn:${DB_PASSWORD}@postgres:5432/qlearn
      LLM_PRIMARY_MODEL: ${LLM_PRIMARY_MODEL}
      LLM_FALLBACK_MODELS: ${LLM_FALLBACK_MODELS}
      VERCEL_TOKEN: ${VERCEL_TOKEN}
    depends_on:
      postgres:
        condition: service_healthy
    command: uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000

  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      - api

volumes:
  pgdata:
```

### Production Deployment

**Supabase** manages Auth, PostgreSQL + pgvector, Storage, and Realtime in production. **Railway** hosts the FastAPI backend (Free tier for development; upgrade to paid for production). **Vercel** hosts the Next.js frontend and provides Sandbox for all compute-heavy execution.

> **Architecture is portable.** The FastAPI service runs in a Docker container and can be deployed to Railway, Fly.io, any VPS, or cloud provider without redesigning Q-Learn. If Railway becomes insufficient, move the service — not the architecture.

| Service | Platform | Purpose |
|---------|----------|---------|
| **Supabase** | Supabase Cloud | Auth, PostgreSQL + pgvector, Storage, Realtime (WebSockets) |
| **FastAPI** | Railway (Free → paid) | API, AI agents, RAG; publishes events to Supabase Realtime |
| **Frontend** | Vercel | Deploy & host Next.js application |
| **Vercel Sandbox** | Vercel (Hobby plan) | Isolated microVM for student code AND quantum circuit simulation |
| **CI/CD** | GitHub Actions | Automated pipeline |

---

## Engineering Rules

1. Use SQLAlchemy 2.x for all database access
2. Use Alembic for every schema migration
3. Never use `Base.metadata.create_all()` in production
4. Keep quantum computation deterministic and separate from LLM reasoning
5. Validate AI-generated circuits before execution
6. Never execute student code inside the API process
7. Keep quantum backends behind the `QuantumBackend` interface
8. Keep agents specialized
9. Use Pydantic schemas for all API I/O
10. Keep API schemas separate from ORM models
11. Prefer service → repository architecture
12. Never expose secrets to clients
13. Do not hardcode environment-specific configuration
14. Write unit tests for deterministic logic
15. Write integration tests for database, AI, and quantum boundaries
16. Prefer incremental changes over rewrites
17. Document important architectural decisions
18. All API endpoints return consistent response format
19. Use async/await throughout for non-blocking I/O
20. Centralize all prompts and agent configurations

---

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.x Documentation](https://docs.sqlalchemy.org/en/20/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [pgvector Documentation](https://pgvector.org/)
- [LangChain Documentation](https://langchain.com/docs)
- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [Celery Documentation](https://docs.celeryq.dev/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Python 3.11 Documentation](https://docs.python.org/3.11/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [SIH 2026 Problem Statement SIH2614](https://www.sih.gov.in/)
