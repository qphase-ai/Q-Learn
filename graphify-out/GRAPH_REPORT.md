# Graph Report - Q-Learn  (2026-09-30)

## Corpus Check
- 377 files · ~209,478 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2210 nodes · 4312 edges · 201 communities (108 shown, 69 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 259 edges (avg confidence: 0.9)
- Token cost: 1,005,384 input · 0 output

## Community Hubs (Navigation)
- Learning Router & Schemas
- Supabase Client & Agent Models
- Frontend Docs & Guidance
- Payload CMS Generated Types
- CMS Proxy API Routes
- Circuit Toolbar & Results Panel
- Frontend Package Manifest
- Auth Callback & Lesson Blocks
- Lesson Content & CMS Source
- Content Ref Service Tests
- Lesson Content Block Components
- Learning Router Tests
- Circuit Canvas & Gate Nodes
- High-Level Architecture Diagram (Services)
- SQLAlchemy Models
- Dashboard Header & UI Primitives
- LLM Model Router
- Content Ref Model & Service
- CMS TS Config
- Utility Pages
- Background Effects Components
- Auth Router Tests
- Home Page & Particle Background
- Frontend TS Config
- Alembic Env & LLM Config
- Quiz Workspace & Generator
- Quantum Backend Interface
- Frontend Architecture Diagram (Zones)
- Dashboard Workspace Components
- RAG Embeddings
- CMS Collections & GraphQL Route
- Auth Pages & Quiz Inputs
- Agent Prompts & Tutor Chain
- Sandbox Execution & Errors
- CMS Package Dependencies
- Design Reference Screenshot (LabShell)
- Auth Pages & Settings
- Circuits Router & DB Session
- CMS-to-Backend Auth
- Legacy Curriculum Import
- CMS Access Control
- Central Workspace & File Tree
- Concept Card & Spotlight Effects
- App Router Pages
- Platform Invariants & Engineering Rules
- Quantum Execution Service
- Circuits Service Tests
- Circuit Gate Palette
- AI Tutor Panel Components
- Backend Agent & RAG Guidance Docs
- RAG Ingestion & Knowledge Models
- Circuit Schema Tests
- CMS Dev Dependencies
- shadcn/ui Component Config
- Visual Effects Components
- Low-Level Architecture Diagram (Services)
- Low-Level Diagram: Sandbox Execution
- Circuits Router Tests
- RAG Ingestion Tests
- Payload Admin Routes
- CMS npm Scripts
- CMS Circuit Spec & Tests
- IDE Shell & Zustand Stores Plan
- App Exception Handling
- CMS Lesson Block Registry
- CMS Content-Ref Registration Hooks
- Curriculum Level Outline
- Infrastructure & Data Flow Diagram
- Home Feature Cards
- Low-Level Diagram: API Routers
- RAG Retrieval Tests
- Curriculum Block Types
- Low-Level Diagram: LLM & Knowledge Tables
- Backend Railway Config
- Auth Test Fakes (Client)
- Auth Test Fakes (DB Session)
- Content Ref Model Tests
- Tutor Chat Message & Citations
- Low-Level Diagram: Middleware Stack
- Auth Dependencies & Router
- Content Refs Router
- Frontend UI Dependencies
- LangGraph Agent Docs
- Content Refs API Docs
- Scaling Architecture Rationale
- Root Layout & Providers
- UI Sheet Component
- CMS Ownership & Publishing Docs
- CMS Package Metadata
- Curriculum & BKT Docs
- Infra & Security Docs
- Low-Level Diagram: Agent Nodes
- CMS Slug API Route
- Sandbox & Data Flow Docs
- Dashboard Activity Bar
- Low-Level Diagram: Agent Orchestration
- Knowledge Seeding Script
- Model Router Scaling Docs
- RAG Pipeline Docs
- Workspace Routing Helper
- Low-Level Diagram: RAG Flow
- Curriculum Seed Migration
- Learning Progress Service
- CI Frontend Job & Changelog
- Auth Middleware
- Sandbox Runner Helpers
- Legacy Export Script Tests
- CMS Next Config
- Lab Shell Plan: Workspace Components
- Backend CI & Quick Start Docs
- CMS GraphQL Route
- Frontend ESLint Config
- Progress Hero Component
- Track Card Component
- Page Transition Component
- UI Label Component
- Realtime Architecture Docs
- Backend Module Map & Docker
- clsx Dependency
- Lesson Blocks & Legacy Import Docs
- CMS ESLint Config
- Payload UI Dependency
- API Design Rules Docs
- Circuit DB Tables
- Framer Motion Dependency
- Frontend Next Config
- Next.js Env Types
- Geist Font Dependency
- KaTeX Dependency
- Lucide Icons Dependency
- Monaco Editor Dependency
- Next.js Dependency
- next-themes Dependency
- Radix Avatar Dependency
- Radix Dialog Dependency
- Radix Dropdown Dependency
- Radix Label Dependency
- Radix Popover Dependency
- Radix Separator Dependency
- Radix Slot Dependency
- Radix Switch Dependency
- Radix Tabs Dependency
- Radix Tooltip Dependency
- React Dependency
- React DOM Dependency
- React Markdown Dependency
- Recharts Dependency
- rehype-katex Dependency
- Sonner Toast Dependency
- Supabase JS Dependency
- tailwindcss-animate Dependency
- React Flow Dependency
- Zustand Dependency
- Frontend pnpm Workspace Config
- Tailwind Config
- Circuit Agent (Topology)
- Evaluation Agent (Topology)
- Orchestrator Agent (Topology)
- Quiz Agent (Topology)
- Recommendation Agent (Topology)
- Research Agent (Topology)
- Tutor Agent (Topology)
- Product Principle
- RAGService Entry Point
- Backend Request Flow Docs
- Backend Database Rules
- Backend Deployment Docs
- CMS pnpm allowBuilds Config
- Claude Code Operating Rules
- Users Table
- Backend Project Metadata
- Adaptive Learning Loop
- AI Safety and Reliability
- RAG Architecture Overview
- Security Overview
- Student Knowledge Model (BKT)
- Monetization (Freemium + Razorpay)

## God Nodes (most connected - your core abstractions)
1. `cn()` - 99 edges
2. `useCircuitStore` - 45 edges
3. `ContentRefService` - 43 edges
4. `LearningService` - 41 edges
5. `Base` - 31 edges
6. `NotFoundError` - 28 edges
7. `useLearningStore` - 28 edges
8. `get_settings()` - 26 edges
9. `_make_mock_db()` - 23 edges
10. `useAuth()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `QuantumBackend Abstract Interface (Project.md)` --semantically_similar_to--> `QuantumBackend ABC`  [INFERRED] [semantically similar]
  Project.md → backend/design.md
- `Agent Architecture (Project.md)` --semantically_similar_to--> `Q-Learn Agent Topology`  [INFERRED] [semantically similar]
  Project.md → AGENTS.md
- `AsyncSandbox.fork() Pattern` --semantically_similar_to--> `SandboxRunner (app/quantum/sandbox_runner.py)`  [INFERRED] [semantically similar]
  docs/Curriculum/q-learn-scaling-architecture.md → docs/sandbox.md
- `test_content_kind_values_match_spec()` --uses--> `ContentKind`  [INFERRED]
  backend/tests/test_content_ref_model.py → backend/app/models/content_ref.py
- `test_content_ref_table_shape()` --uses--> `ContentRef`  [INFERRED]
  backend/tests/test_content_ref_model.py → backend/app/models/content_ref.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **No In-Process Qiskit Execution Pattern** — agents_platform_invariants, backend_agents_non_negotiable_rules, backend_design_qiskitaeradapter, project_quantum_execution_flow [INFERRED 0.85]
- **Supabase Realtime Pub/Sub Replaces WebSockets** — agents_realtime_architecture, backend_design_websocket_communication, claude_key_external_boundaries, readme_key_design_decisions [INFERRED 0.85]
- **CMS/Backend content_refs Ownership Boundary** — cms_agents_ownership_rule, cms_readme_publishing_flow, changelog_cms_curriculum_store, claude_payload_cms_boundary [INFERRED 0.85]
- **Payload CMS ↔ content_refs ↔ FastAPI Learner State Boundary** — docs_curriculum_cirrculum_store_architecture_payload_cms, docs_curriculum_cirrculum_store_architecture_content_refs_table, docs_database_content_refs, docs_curriculum_cirrculum_store_architecture_contentrefservice, docs_api_internal_content_refs_endpoint [EXTRACTED 1.00]
- **Multi-Agent Orchestration with Shared Tool Layer and Persistence** — docs_agents_orchestrator, docs_agents_shared_tool_layer, docs_agents_asyncpostgressaver, docs_agents_tutor_agent, docs_agents_evaluation_agent [EXTRACTED 1.00]
- **Circuit Execution Chain: QuantumBackend → SandboxRunner → Vercel Sandbox → Realtime** — docs_quantum_execution_quantumbackend_interface, docs_quantum_execution_qiskitaeradapter, docs_sandbox_sandboxrunner, docs_data_flow_sandboxrunner_run_python, docs_frontend_layer_supabase_realtime_subscription [EXTRACTED 1.00]
- **AppShell six-zone shell composition** — frontend_design_md_appshell, frontend_design_md_titlebar, frontend_design_md_activitybar, frontend_design_md_workspacearea, frontend_design_md_rightpanel, frontend_design_md_bottompanel, frontend_design_md_statusbar [EXTRACTED 1.00]
- **LabShell zone composition** — frontend_claude_md_labshell, frontend_claude_md_dashboardheader, frontend_claude_md_dashboardactivitybar, frontend_claude_md_curriculumsidebar, frontend_claude_md_centralworkspace, frontend_claude_md_dashboardtutorpanel [EXTRACTED 1.00]
- **Zustand domain-store state management pattern** — frontend_design_md_useshellstore, frontend_design_md_useauthstore, frontend_design_md_uselearningstore, frontend_design_md_usecircuitstore, frontend_design_md_usetutorstore, frontend_design_md_usequizstore, frontend_agents_md_usebillingstore [INFERRED 0.85]

## Communities (201 total, 69 thin omitted)

### Community 0 - "Learning Router & Schemas"
Cohesion: 0.07
Nodes (55): get_course_detail(), get_lesson(), get_progress(), list_courses(), AsyncSession, get, UUID, upsert_progress() (+47 more)

### Community 1 - "Supabase Client & Agent Models"
Cohesion: 0.06
Nodes (64): get_supabase(), AsyncClient, Return a lazily-created, process-wide async Supabase client. Cached in a module…, NotFoundError, AgentMessage, chat(), get_tutor_session(), AsyncSession (+56 more)

### Community 2 - "Frontend Docs & Guidance"
Cohesion: 0.06
Nodes (50): AGENTS.md (Frontend Agent Guidance), apiFetch<T> client (lib/api.ts), Pro gating (subscription_status), Supabase Realtime subscription pattern, useBillingStore, CLAUDE.md (Frontend), CentralWorkspace, CircuitResultsPanel (+42 more)

### Community 3 - "Payload CMS Generated Types"
Cohesion: 0.04
Nodes (47): Auth, CalloutBlock, CalloutBlockSelect, CircuitBlock, CircuitBlockSelect, CmsUser, CmsUserAuthOperations, CmsUsersSelect (+39 more)

### Community 4 - "CMS Proxy API Routes"
Cohesion: 0.09
Nodes (37): GET(), dynamic, GET(), GET(), respond(), authorized(), POST(), absolutizeMedia() (+29 more)

### Community 5 - "Circuit Toolbar & Results Panel"
Cohesion: 0.11
Nodes (26): CircuitToolbar(), handleExport(), CircuitResultsPanel(), keyInsight(), askTutor(), Editor, MonacoCodePanel(), angleForBitstring() (+18 more)

### Community 6 - "Frontend Package Manifest"
Cohesion: 0.05
Nodes (42): autoprefixer, devDependencies, autoprefixer, eslint, eslint-config-next, jsdom, postcss, tailwindcss (+34 more)

### Community 7 - "Auth Callback & Lesson Blocks"
Cohesion: 0.11
Nodes (25): LessonBlocks(), SimulationBlock(), run(), apiFetch(), getAccessToken(), subscribeToCircuitResult(), subscribeToTutor(), supabase (+17 more)

### Community 8 - "Lesson Content & CMS Source"
Cohesion: 0.08
Nodes (31): LessonContent(), cmsContent, contentSource, isTrackableLessonId(), LearningStore, useLearningStore, CourseDetail, CourseSummary (+23 more)

### Community 9 - "Content Ref Service Tests"
Cohesion: 0.16
Nodes (15): ContentRefService, AsyncSession, _integrity_error(), _make_mock_db(), _make_ref(), parametrize, Tests for ContentRefService. Hermetic — no real DB connections. All DB I/O is…, A bind that loses a race at commit is a 409, not a raw IntegrityError. (+7 more)

### Community 10 - "Lesson Content Block Components"
Cohesion: 0.11
Nodes (22): CalloutBlock(), VARIANT_CLASSES, CircuitBlock(), CodeBlock(), HeadingBlock(), ImageBlock(), BlockRegistry, MarkdownBlock() (+14 more)

### Community 11 - "Learning Router Tests"
Cohesion: 0.11
Nodes (32): clean_overrides(), client(), _fake_course(), _fake_lesson(), _fake_progress(), _fake_user(), AsyncClient, fixture (+24 more)

### Community 12 - "Circuit Canvas & Gate Nodes"
Cohesion: 0.09
Nodes (27): CircuitCanvas(), CircuitCanvasInner(), nodeTypes, TWO_QUBIT_GATES, gateColor(), gateLabelColor(), GateNode(), MeasurementNode() (+19 more)

### Community 13 - "High-Level Architecture Diagram (Services)"
Cohesion: 0.09
Nodes (33): Agent/LangGraph Service, AI Tutor Chat (Frontend), Analytics / Recommendation Service, API Gateway (JWT Auth, Rate Limiting, Validation, Structlog), Assessment Service, Auth Pages, Auth Service (Backend), Browser Client (Student/Instructor/Admin) (+25 more)

### Community 14 - "SQLAlchemy Models"
Cohesion: 0.17
Nodes (22): AgentSession, ChallengeAttempt, CodingChallenge, QuizAttempt, QuizQuestion, Base, Circuit, CircuitExecution (+14 more)

### Community 15 - "Dashboard Header & UI Primitives"
Cohesion: 0.12
Nodes (24): Avatar, AvatarFallback, AvatarImage, DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay (+16 more)

### Community 16 - "LLM Model Router"
Cohesion: 0.09
Nodes (23): ModelRouter, Remove timestamps older than 60 s from this model's window. Lock must be held., Return current rolling RPM for model. Trims stale entries as a side effect., Record one request for model at the current time., Return models sorted by remaining RPM headroom, highest first., get_llm() picks the model with the highest headroom as primary., Saturating one model's window pushes it behind a lower-limit but empty model., Timestamps older than 60 s are trimmed; headroom fully recovers. (+15 more)

### Community 17 - "Content Ref Model & Service"
Cohesion: 0.12
Nodes (22): ConflictError, ContentKind, ContentRef, content_refs — stable, backend-owned identity for CMS-authored content. Payload…, UUID, Content ref service — resolves the content_refs integration boundary.…, Return the ref, or raise NotFoundError if absent or of another kind., Look up a ref by its Payload document id (uses the unique index). (+14 more)

### Community 18 - "CMS TS Config"
Cohesion: 0.06
Nodes (30): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+22 more)

### Community 19 - "Utility Pages"
Cohesion: 0.09
Nodes (11): DocLink, DocsView(), EXTERNAL, IN_APP, CATEGORIES, Category, FeedbackView(), FEATURES (+3 more)

### Community 20 - "Background Effects Components"
Cohesion: 0.11
Nodes (12): AuroraBackground(), GlowingOrbs(), Orb, ORBS, GridBackground(), MeshGradient(), NoiseOverlay(), QuantumSpinBackground() (+4 more)

### Community 21 - "Auth Router Tests"
Cohesion: 0.14
Nodes (25): client(), fake_db(), make_es256_keypair(), make_es256_token(), make_supabase_token(), AsyncClient, fixture, parametrize (+17 more)

### Community 22 - "Home Page & Particle Background"
Cohesion: 0.10
Nodes (16): DOT_COLORS, Particle, ParticleNetwork(), FeaturesSection(), HeroCircuitSVG(), HeroSection(), HomeFooter(), HowItWorksSection() (+8 more)

### Community 23 - "Frontend TS Config"
Cohesion: 0.08
Nodes (25): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+17 more)

### Community 24 - "Alembic Env & LLM Config"
Cohesion: 0.14
Nodes (18): do_run_migrations(), run_migrations_offline(), run_migrations_online(), get_llm(), _make_llm(), Return a ChatLiteLLM instance routed to the model with the most remaining RPM…, Create a ChatLiteLLM instance with optional OpenRouter extra headers., get_settings() (+10 more)

### Community 25 - "Quiz Workspace & Generator"
Cohesion: 0.17
Nodes (15): QuestionDisplay(), QuizWorkspace(), generateQuizFromLesson(), multipleChoiceQuestion(), quizFromBlocks(), shuffle(), trueFalseQuestion(), QuizStore (+7 more)

### Community 26 - "Quantum Backend Interface"
Cohesion: 0.21
Nodes (10): ABC, CircuitSpec, CompiledCircuit, ExecutionResult, QuantumBackend, CircuitSpec, ExecutionResult, QiskitAerAdapter (+2 more)

### Community 27 - "Frontend Architecture Diagram (Zones)"
Cohesion: 0.12
Nodes (23): Zone 2 — Activity Bar (mode icons), Zone 5 — Bottom Panel (Simulation Results), Circuit Builder workspace mode, ConversationHistory component (virtualized, MessageBubble variants), Q-Learn Frontend High-Level Architecture Diagram, LearningPathTimeline component, MessageInput component, NextActivityCard component (+15 more)

### Community 28 - "Dashboard Workspace Components"
Cohesion: 0.27
Nodes (16): CentralWorkspace(), CurriculumSidebar(), toggleModule(), DashboardHeader(), ProgressView(), Skeleton(), findModuleIndexForLesson(), firstSentence() (+8 more)

### Community 29 - "RAG Embeddings"
Cohesion: 0.13
Nodes (18): embed_batch(), embed_text(), _get_model(), _load_model(), RAG embedding helper — all-MiniLM-L6-v2 (dim=384). The SentenceTransformer…, Import and construct the SentenceTransformer. Isolated so tests can patch it., Embed a single string into a 384-dim vector., Embed a list of strings into a list of 384-dim vectors. (+10 more)

### Community 30 - "CMS Collections & GraphQL Route"
Cohesion: 0.16
Nodes (14): GET, CmsUsers, Curriculums, Lessons, Levels, Media, Modules, orderField() (+6 more)

### Community 31 - "Auth Pages & Quiz Inputs"
Cohesion: 0.16
Nodes (9): AnswerOptions(), HintButton(), QuizNavigation(), QuizProgressBar(), Button, buttonVariants, MotionSlot, Input (+1 more)

### Community 32 - "Agent Prompts & Tutor Chain"
Cohesion: 0.17
Nodes (16): Centralized agent prompts. All prompt strings live here (never scattered across…, _format_context(), Tutor streaming chain — build a grounded prompt and stream the answer. Single…, Number the retrieved chunks so the model can cite them as [1], [2], ..., Stream a grounded tutor answer token-by-token. `context` may carry `level` and…, stream_tutor_answer(), RetrievedChunk, _chunks() (+8 more)

### Community 33 - "Sandbox Execution & Errors"
Cohesion: 0.23
Nodes (17): Raised when code executed inside the sandbox fails (non-zero exit, empty…, SandboxExecutionError, GateSpec, SandboxResult, _adapter_with(), _FakeRunner, CircuitSpec, _qasm() (+9 more)

### Community 34 - "CMS Package Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, cross-env, graphql, next, payload, @payloadcms/db-postgres, @payloadcms/next, @payloadcms/storage-s3 (+13 more)

### Community 35 - "Design Reference Screenshot (LabShell)"
Cohesion: 0.13
Nodes (21): AI Tutor Panel, Quantum State Visualization (Bloch Sphere), Central Workspace (Lesson 3.2 Multi-Qubit Gates), Circuit Code Panel (Qiskit), Circuit Explanation (Step-by-step Bell State), Curriculum Sidebar, Cyberpunk/Glassmorphism Dark Theme, Dashboard Activity Bar (Left Nav Rail) (+13 more)

### Community 36 - "Auth Pages & Settings"
Cohesion: 0.16
Nodes (18): AuthCallbackPage(), LoginPage(), handleSubmit(), RegisterPage(), handleSubmit(), SettingsView(), AuthHydrator(), clearAuthCookie() (+10 more)

### Community 37 - "Circuits Router & DB Session"
Cohesion: 0.18
Nodes (16): get_db(), AsyncSession, execute_circuit(), AsyncSession, BackgroundTasks, post, UUID, CircuitCreateRequest (+8 more)

### Community 38 - "CMS-to-Backend Auth"
Cohesion: 0.17
Nodes (15): Authenticate server-to-server calls from the Payload CMS. The CMS has no…, require_admin(), require_cms_secret(), require_instructor(), ForbiddenError, UnauthorizedError, AuthService, _get_signing_key() (+7 more)

### Community 39 - "Legacy Curriculum Import"
Cohesion: 0.15
Nodes (16): byOrder(), context, findOne(), LegacyCourse, LegacyExport, LegacyLesson, LegacyModule, main() (+8 more)

### Community 40 - "CMS Access Control"
Cohesion: 0.26
Nodes (14): authenticated(), CmsRole, cmsUser(), CmsUserLike, isPublisher(), publishedOrAuthenticated(), publisherField(), publishers() (+6 more)

### Community 41 - "Central Workspace & File Tree"
Cohesion: 0.14
Nodes (13): CentralTab, FileTreePanel(), STARTER_FILES, TabsContent, TabsList, TabsTrigger, isTypingTarget(), useCircuitShortcuts() (+5 more)

### Community 42 - "Concept Card & Spotlight Effects"
Cohesion: 0.14
Nodes (13): ConceptCard(), SpotlightCard, SpotlightCardProps, Step, STEPS, ProbabilityMockSVG(), Card, CardContent (+5 more)

### Community 43 - "App Router Pages"
Cohesion: 0.19
Nodes (7): CircuitPage(), CodePage(), LearnPage(), QuizPage(), DashboardWorkspace(), LabShell(), useCourseBootstrap()

### Community 44 - "Platform Invariants & Engineering Rules"
Cohesion: 0.12
Nodes (18): Q-Learn Agent Topology, Platform-Level Invariants, Engineering Rules, Low-Level Architecture Layers, Three-Tier Architecture, Backend Directory Map, QuantumBackend ABC, Backend API Routes Overview (+10 more)

### Community 45 - "Quantum Execution Service"
Cohesion: 0.15
Nodes (14): ValidationError, CircuitSpec, ExecutionResult, QuantumExecutionService, CircuitSpec, PydanticCircuitSpec, UUID, Execute a circuit in the quantum sandbox and publish the result via Realtime.… (+6 more)

### Community 46 - "Circuits Service Tests"
Cohesion: 0.25
Nodes (10): CircuitsService, AsyncSession, _make_mock_db(), _make_request(), asyncio, fixture, When db.get returns an existing Circuit, update its fields (no duplicate add)., ValidationError raised before any db.add if validate() returns errors. The… (+2 more)

### Community 47 - "Circuit Gate Palette"
Cohesion: 0.17
Nodes (11): DraggableGate(), DraggableGateProps, gateBackground(), gateLabelColor(), GatePalette(), MEASURE, SINGLE_QUBIT, TWO_QUBIT (+3 more)

### Community 48 - "AI Tutor Panel Components"
Cohesion: 0.16
Nodes (11): AskableTab, DashboardTutorPanel(), TAB_META, TutorTab, CANNED_PROMPTS, LabShellChildContext, LabShellSidebarProps, AITutorPanel() (+3 more)

### Community 49 - "Backend Agent & RAG Guidance Docs"
Cohesion: 0.12
Nodes (17): Quantum Execution Layer (root AGENTS.md), RAG Pipeline (root AGENTS.md), LLM Model Router (ModelRouter), Backend Non-Negotiable Rules, Backend Key Patterns, AgentOrchestratorService, CircuitService, QiskitAerAdapter (+9 more)

### Community 50 - "RAG Ingestion & Knowledge Models"
Cohesion: 0.23
Nodes (12): DocumentChunk, KnowledgeDocument, KnowledgeEmbedding, RAG ingestion — chunk documents and persist chunks + embeddings. `chunk_text`…, RAG retrieval — pgvector cosine nearest-neighbour search. Lean pgvector-only…, _make_mock_db(), asyncio, Tests for the knowledge-base seed script. Hermetic: embed_batch is mocked and… (+4 more)

### Community 51 - "Circuit Schema Tests"
Cohesion: 0.20
Nodes (12): GateSpec, _make_execution_result(), _make_pydantic_spec(), _make_session_cm(), PydanticCircuitSpec, Tests for CircuitsService and run_and_publish. Hermetic — no real DB or…, Return an async context manager that yields mock_db., Tests for the module-level run_and_publish function. (+4 more)

### Community 52 - "CMS Dev Dependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, eslint-config-next, @types/node, @types/react, @types/react-dom, typescript, vite-tsconfig-paths (+9 more)

### Community 53 - "shadcn/ui Component Config"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 54 - "Visual Effects Components"
Cohesion: 0.16
Nodes (11): AnimatedBeam(), AnimatedBeamProps, GlowingBorder, GlowingBorderProps, MagneticButton, MagneticButtonProps, ShimmerText(), ShimmerTextProps (+3 more)

### Community 55 - "Low-Level Architecture Diagram (Services)"
Cohesion: 0.16
Nodes (16): analytics_service.py (learning metrics, class analytics), assessment_service.py (quiz generation, evaluation, scoring), auth_service.py (JWT issue/verify, bcrypt hash, RBAC), circuit_service.py (CRUD, validate, export OpenQASM), content_service (file mgmt, versioning), Assessments tables (quizzes, quiz_questions, quiz_attempts, coding_challenges, challenge_attempts), Circuits tables (circuits, circuit_executions), Learning tables (courses, modules, lessons, concepts, learning_progress, skill_mastery) (+8 more)

### Community 56 - "Low-Level Diagram: Sandbox Execution"
Cohesion: 0.13
Nodes (16): AsyncSandbox.fork(source=qlearn-python-base), _compile_to_qasm() / _render_qiskit_script(), microVM: python -c script (Qiskit Aer runs), _parse_result(stdout) → ExecutionResult, QiskitAerAdapter.execute(circuit, shots), Qiskit Aer sim, Quantum Execution Path, quantum_execution_service.py (backend adapter registry) (+8 more)

### Community 57 - "Circuits Router Tests"
Cohesion: 0.21
Nodes (15): clean_overrides(), client(), _fake_user(), AsyncClient, fixture, UUID, Tests for POST /api/v1/circuits/{circuit_id}/execute. Hermetic — no live…, No Authorization header → 401 or 403 (HTTPBearer rejects before handler). (+7 more)

### Community 58 - "RAG Ingestion Tests"
Cohesion: 0.25
Nodes (13): chunk_text(), ingest_document(), AsyncSession, Split text into overlapping windows of whitespace tokens. Windows are `size`…, Create a document + its chunks + embeddings, then commit. Embeddings are…, _make_mock_db(), asyncio, Tests for RAG ingestion — chunk_text (pure) and ingest_document (mocked DB).… (+5 more)

### Community 59 - "Payload Admin Routes"
Cohesion: 0.18
Nodes (4): importMap, Args, Args, Args

### Community 60 - "CMS npm Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, generate:importmap, generate:types, import:legacy, lint, migrate (+5 more)

### Community 61 - "CMS Circuit Spec & Tests"
Cohesion: 0.22
Nodes (11): circuitSpecErrors(), CONTROLLED_GATES, GATE_KEYS, GateSpec, isIndex(), isPlainObject(), MAX_QUBITS, SPEC_KEYS (+3 more)

### Community 62 - "IDE Shell & Zustand Stores Plan"
Cohesion: 0.17
Nodes (13): AppShell (VS Code-style IDE shell), Shell 6 Zones / 6 Workspace Modes, Zustand Domain Stores (7 stores), AppShell Modification (remove RightPanel, add TutorFAB), DashboardWorkspace Component, ProgressHero Component, QuantumSpinBackground Component, shellStore (Zustand) (+5 more)

### Community 63 - "App Exception Handling"
Cohesion: 0.30
Nodes (8): Any, qlearn_exception_handler(), QlearnError, create_app(), lifespan(), FastAPI, JSONResponse, Request

### Community 64 - "CMS Lesson Block Registry"
Cohesion: 0.17
Nodes (11): CalloutBlock, CircuitBlock, CodeBlock, HeadingBlock, ImageBlock, lessonBlocks, MarkdownBlock, MathBlock (+3 more)

### Community 65 - "CMS Content-Ref Registration Hooks"
Cohesion: 0.23
Nodes (6): registerLessonRef(), RegisterResult, RevalidatePayload, registerContentRef(), SKIP_CONTENT_REF_SYNC, fetchMock

### Community 66 - "Curriculum Level Outline"
Cohesion: 0.17
Nodes (12): Level 0 — Computing Fundamentals, Level 11 — Quantum Programming with Qiskit, Level 14 — Noise, Decoherence & QEC Basics, Level 15 — Quantum Algorithms I, Level 16 — Grover's Search Algorithm, Level 17 — QFT & Phase Estimation, Level 18 — Shor's Factoring Algorithm, Level 19 — Advanced Topics & Capstone (+4 more)

### Community 67 - "Infrastructure & Data Flow Diagram"
Cohesion: 0.35
Nodes (12): Q-Learn Infrastructure & Data Flow Diagram, GitHub Actions — CI/CD, LLM Provider (ChatLiteLLM), Postgres + pgvector, Railway — FastAPI (Docker, Application tier), Razorpay, Student Browser, Supabase Auth (JWT HS256 issuer) (+4 more)

### Community 68 - "Home Feature Cards"
Cohesion: 0.23
Nodes (9): FeatureCard(), FeatureCardProps, FEATURES, itemVariants, itemVariantsReduced, StaggerContainer(), StaggerContainerProps, StaggerItem() (+1 more)

### Community 69 - "Low-Level Diagram: API Routers"
Cohesion: 0.18
Nodes (11): admin.py (GET /admin/users, /system), analytics.py (GET /analytics/learning, /user/{id}), auth.py (POST /auth/register, /login, /refresh), challenges.py (POST /challenges/{id}/submit), circuits.py (CRUD /circuits, /execute, /export), instructor.py (GET /instructor/classes, /students), learning.py (GET /courses, /modules, /lessons), quizzes.py (GET /quizzes, POST /start, /submit) (+3 more)

### Community 70 - "RAG Retrieval Tests"
Cohesion: 0.31
Nodes (10): AsyncSession, Return the top-k chunks nearest the query, ordered closest-first., retrieve(), _make_chunk(), _make_doc(), _make_result(), asyncio, Tests for RAG retrieval — retrieve() with a mocked DB session. Hermetic:… (+2 more)

### Community 71 - "Curriculum Block Types"
Cohesion: 0.20
Nodes (11): Block Registry (10 typed block types), blocksAsJSON Storage Strategy, Circuit Block (CircuitSpec), Frontend BlockRegistry Component Map, Quiz Block, Simulation Block, CirqAdapter (Phase 2), Circuit Execution Sequence (fork-per-circuit) (+3 more)

### Community 72 - "Low-Level Diagram: LLM & Knowledge Tables"
Cohesion: 0.20
Nodes (10): Claude (Anthropic), Knowledge (RAG) tables (knowledge_documents, document_chunks, knowledge_embeddings), Embedding model: sentence-transformers/all-MiniLM-L6-v2 (dim=384), Gemini, GPT-4 (OpenAI), LLM Provider (pluggable), Ollama (local dev), RAG Pipeline (+2 more)

### Community 73 - "Backend Railway Config"
Cohesion: 0.20
Nodes (9): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, restartPolicyMaxRetries, restartPolicyType (+1 more)

### Community 74 - "Auth Test Fakes (Client)"
Cohesion: 0.20
Nodes (3): _FakeAsyncClient, _FakeResp, Minimal stand-in for httpx.AsyncClient serving a fixed JWKS payload.

### Community 75 - "Auth Test Fakes (DB Session)"
Cohesion: 0.20
Nodes (3): _FakeExecuteResult, _FakeSession, In-memory stand-in for AsyncSession backing ``AuthService._sync_user``. Keeps…

### Community 76 - "Content Ref Model Tests"
Cohesion: 0.27
Nodes (8): _fk_targets(), Hermetic tests for the content_refs boundary model and migration graph., test_content_kind_values_match_spec(), test_content_ref_table_shape(), test_is_legacy_reflects_sentinel_prefix(), test_progress_lesson_fk_targets_content_refs(), test_quiz_question_lesson_fk_targets_content_refs(), test_skill_mastery_still_targets_concepts()

### Community 77 - "Tutor Chat Message & Citations"
Cohesion: 0.29
Nodes (6): ChatMessage(), CitationBadge(), Badge(), BadgeProps, badgeVariants, base

### Community 78 - "Low-Level Diagram: Middleware Stack"
Cohesion: 0.22
Nodes (9): CORS + Structlog Middleware, Q-Learn Low-Level Backend Architecture, app/main.py create_app(), HTTP Request (GET/POST/PUT/DELETE), JWT Auth Check (app/dependencies.py), Middleware Stack, Pydantic Request Validation, Global QlearnError Exception Handler (+1 more)

### Community 79 - "Auth Dependencies & Router"
Cohesion: 0.28
Nodes (7): get_current_user(), AsyncSession, me(), get, BaseModel, UserResponse, HTTPAuthorizationCredentials

### Community 80 - "Content Refs Router"
Cohesion: 0.33
Nodes (7): AsyncSession, post, Internal endpoints the Payload CMS calls to maintain content_refs. Not for…, register_content_ref(), ContentRefOut, BaseModel, RegisterContentRefRequest

### Community 81 - "Frontend UI Dependencies"
Cohesion: 0.22
Nodes (9): class-variance-authority, dependencies, class-variance-authority, @radix-ui/react-progress, remark-math, tailwind-merge, @radix-ui/react-progress, remark-math (+1 more)

### Community 82 - "LangGraph Agent Docs"
Cohesion: 0.33
Nodes (9): AsyncPostgresSaver (LangGraph checkpointer), Circuit Agent, Learning Orchestrator Agent, Quiz Agent, Recommendation Agent, Research Agent, Shared Tool Layer, Tutor Agent (+1 more)

### Community 83 - "Content Refs API Docs"
Cohesion: 0.22
Nodes (9): POST /api/v1/internal/content-refs, Content Ownership Boundary (Payload owns content, FastAPI owns learner state), content_refs Table (integration boundary), ContentRefService, Legacy → Payload Migration Plan, content_refs Table, Router→Service→Repository→SQLAlchemy→PostgreSQL Dependency Direction, quiz_questions table (+1 more)

### Community 84 - "Scaling Architecture Rationale"
Cohesion: 0.22
Nodes (9): Content Model (Curriculum→Level→Module→Lesson→blocks), Payload CMS (cms/ Next.js 16 app), AsyncSandbox.fork() Pattern, Bottleneck Ranking (100k-user scale), Decoupled Content vs Execution Paths (LeetCode-style pattern), Execution Job Queue (build proactively), Phased Scaling Roadmap (Phase 0–3), Redis Content Cache — Measure-First Decision (+1 more)

### Community 85 - "Root Layout & Providers"
Cohesion: 0.28
Nodes (5): jetbrainsMono, metadata, Providers(), Toaster(), ToasterProps

### Community 86 - "UI Sheet Component"
Cohesion: 0.25
Nodes (8): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 87 - "CMS Ownership & Publishing Docs"
Cohesion: 0.25
Nodes (8): Payload CMS Curriculum Store (Changelog), Payload CMS Boundary, CMS Ownership Rule (Payload vs FastAPI), cms/CLAUDE.md includes AGENTS.md, CMS Publishing Flow, CMS Setup & Commands, cms service (Payload), CMS CI Job

### Community 88 - "CMS Package Metadata"
Cohesion: 0.25
Nodes (7): description, engines, node, name, private, type, version

### Community 89 - "Curriculum & BKT Docs"
Cohesion: 0.29
Nodes (8): Evaluation Agent, 20-Level Q-Learn Curriculum, Bayesian Knowledge Tracing (BKT) Engine, Learn→Build→Simulate→Observe→Explain→Practice Loop, Mastery Concept Graph, Milestone Badges (Explorer→Quantum Engineer), skill_mastery table (BKT), QuizWorkspace Component

### Community 90 - "Infra & Security Docs"
Cohesion: 0.25
Nodes (8): DATABASE_URL Two-URL Model (pooler vs direct), Production Stack (Supabase/Railway/Vercel), Row Level Security (enabled, no policies), NEXT_PUBLIC_DEV_NO_AUTH Flag, Docker Compose Local Setup, Supabase Auth Sign-In Flow, Security Auth Flow (Supabase Auth + JWT verify), RBAC Roles (student/instructor/admin)

### Community 91 - "Low-Level Diagram: Agent Nodes"
Cohesion: 0.48
Nodes (7): Circuit Agent Node, Eval Agent Node, Rec Agent Node, Research Agent Node, AgentResponse (content, sources, recs), Tutor Agent Node, Orchestrator Node (route decision)

### Community 92 - "CMS Slug API Route"
Cohesion: 0.29
Nodes (6): DELETE, GET, OPTIONS, PATCH, POST, PUT

### Community 93 - "Sandbox & Data Flow Docs"
Cohesion: 0.29
Nodes (7): SandboxRunner.run_python(), Seven Key Data Flows, Supabase Realtime Channel Subscription, deny-all Network Policy, SandboxRunner (app/quantum/sandbox_runner.py), Warm Qiskit Snapshot/Image Runtime, Security Controls Table

### Community 94 - "Dashboard Activity Bar"
Cohesion: 0.43
Nodes (3): DashboardActivityBar(), NavItem, TooltipContent

### Community 95 - "Low-Level Diagram: Agent Orchestration"
Cohesion: 0.40
Nodes (6): agent_orchestrator_service.py (LangGraph StateGraph, 6 agent nodes), AsyncPostgresSaver (LangGraph checkpointer), Agents tables (agent_sessions, agent_messages, LangGraph checkpoints), LangGraph Agent Orchestration, Prompts centralised in app/agents/prompts.py, agents.py (POST /agents/chat, /circuit-explain)

### Community 96 - "Knowledge Seeding Script"
Cohesion: 0.40
Nodes (5): _main(), AsyncSession, Seed the RAG knowledge base with a curated quantum-computing corpus. Run once…, Ingest every corpus document. Returns the number of documents ingested., seed()

### Community 97 - "Model Router Scaling Docs"
Cohesion: 0.40
Nodes (6): ModelRouter RPM Counter — Shared State Requirement, get_llm(), ModelRouter, Redis Sorted-Set Multi-Replica Plan, Sliding-Window Headroom Algorithm, LangChain .with_fallbacks() Reactive Chain

### Community 98 - "RAG Pipeline Docs"
Cohesion: 0.33
Nodes (6): knowledge_embeddings table (pgvector 384-dim), BM25 Sparse Search, Cross-Encoder Reranker (ms-marco-MiniLM-L-6-v2), Embedding Model (all-MiniLM-L6-v2 dim=384), RRF Fusion (Reciprocal Rank Fusion), Vector Search (pgvector, k=12)

### Community 99 - "Workspace Routing Helper"
Cohesion: 0.47
Nodes (4): workspaceFromPathname(), WorkspaceId, WorkspaceMeta, WORKSPACES

### Community 100 - "Low-Level Diagram: RAG Flow"
Cohesion: 0.50
Nodes (5): BM25 Search, LLM Synthesis → RAGResponse + citations, pgvector (dense k=12), User Query → Query Rewriting (if context), RRF Fusion → Cross-Encoder Rerank (top-5)

### Community 102 - "Learning Progress Service"
Cohesion: 0.40
Nodes (3): UUID, Return all progress rows for a user., Insert or update the student's progress for a lesson. Refreshes…

### Community 103 - "CI Frontend Job & Changelog"
Cohesion: 0.40
Nodes (5): IDE Shell & Auth (Changelog), Marketing Home Page (Changelog), Frontend Architecture (IDE Shell), web service (Next.js), Frontend CI Job

### Community 104 - "Auth Middleware"
Cohesion: 0.40
Nodes (3): AUTH_ROUTES, config, PROTECTED_ROUTES

### Community 105 - "Sandbox Runner Helpers"
Cohesion: 0.50
Nodes (3): _as_text(), Normalize an SDK stdout/stderr field that may be str, bytes, or None., Execute ``code`` as ``python -c <code>`` in a fresh sandbox. Returns the…

### Community 107 - "CMS Next Config"
Cohesion: 0.50
Nodes (3): dirname, __filename, nextConfig

### Community 108 - "Lab Shell Plan: Workspace Components"
Cohesion: 0.50
Nodes (4): CentralWorkspace lockedTab Mode, CircuitResultsPanel Component, FileTreePanel Component, MonacoCodePanel Component

### Community 114 - "Backend CI & Quick Start Docs"
Cohesion: 0.67
Nodes (3): Backend Quick Start, Testing Strategy (Development.md), Backend CI Job

## Ambiguous Edges - Review These
- `design.md (Frontend Design)` → `Design system tokens (HSL / Tailwind semantic classes)`  [AMBIGUOUS]
  frontend/CLAUDE.md · relation: conceptually_related_to
- `AppShell (persistent VS Code IDE shell)` → `LabShell`  [AMBIGUOUS]
  frontend/CLAUDE.md · relation: conceptually_related_to
- `CircuitResultsPanel` → `QASMViewer`  [AMBIGUOUS]
  frontend/CLAUDE.md · relation: references

## Knowledge Gaps
- **561 isolated node(s):** `qlearn-api`, `$schema`, `builder`, `dockerfilePath`, `healthcheckPath` (+556 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 876 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **69 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `design.md (Frontend Design)` and `Design system tokens (HSL / Tailwind semantic classes)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `AppShell (persistent VS Code IDE shell)` and `LabShell`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `CircuitResultsPanel` and `QASMViewer`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `cn()` connect `Dashboard Header & UI Primitives` to `Home Feature Cards`, `Circuit Toolbar & Results Panel`, `Central Workspace & File Tree`, `Concept Card & Spotlight Effects`, `Lesson Content Block Components`, `Tutor Chat Message & Citations`, `Background Effects Components`, `Visual Effects Components`, `Home Page & Particle Background`, `UI Sheet Component`, `UI Label Component`, `Dashboard Workspace Components`, `Dashboard Activity Bar`, `Auth Pages & Quiz Inputs`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `get_settings()` connect `Alembic Env & LLM Config` to `Supabase Client & Agent Models`, `Circuits Router & DB Session`, `CMS-to-Backend Auth`, `Content Ref Model & Service`, `Auth Router Tests`, `Quantum Backend Interface`, `App Exception Handling`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `get_llm()` connect `Alembic Env & LLM Config` to `Agent Prompts & Tutor Chain`, `LLM Model Router`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `ContentRefService` (e.g. with `register_content_ref()` and `ConflictError`) actually correct?**
  _`ContentRefService` has 11 INFERRED edges - model-reasoned connections that need verification._