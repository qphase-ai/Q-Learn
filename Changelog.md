# Changelog

All notable changes to Q-Learn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — Backend hosting moved from Railway to InstaCloud (2026-10-17)

- **API host**: the FastAPI backend now runs on InstaCloud as the always-on compute service `api` (project `q-learn`, branch `main`, `us-east`, port `8000`), built from the unchanged `backend/Dockerfile`. Live URL: `https://prod-main-api-e7ab8e-008pmc86yhk.compute.instacloud-edge.com` (`/health`, `/docs`).
- **No data migration**: the database stays on Supabase. The 23 Railway service variables were copied to InstaCloud project secrets and verified by hash; Railway built-ins (`RAILWAY_*`, `PORT`) were dropped.
- **Frontend**: Vercel `NEXT_PUBLIC_API_URL` (production + preview) now points at the InstaCloud URL, and production was redeployed to pick it up.
- **Repo**: `.insta/project.json` links the repo to the InstaCloud project; `.gitignore` covers InstaCloud's local session and audit files.
- **Docs**: README, `CLAUDE.md`, `AGENTS.md`, `Architecture.md`, `Project.md`, `Development.md`, `backend/README.md`, `backend/design.md`, `frontend/design.md` and `docs/` now name InstaCloud as the API host. `docs/infrastructure.md` has a new deploy and operations runbook, and the Railway-specific DNS troubleshooting note is gone.
- **Railway**: `q-learn-api` stays up during a soak period and will then be decommissioned. `backend/railway.json` is kept until then.

### Added — AI Classroom backend (text-first slice)

- **`/api/v1/classroom`**: `POST /sessions`, `POST /sessions/{id}/turns` (202, idempotent on `client_message_id`), `POST /sessions/{id}/interrupt`, `GET /sessions/{id}`, `GET /sessions/{id}/state?after_seq=N`. Per-user slowapi limits on these routes only.
- **`app/agents/classroom/`**: LangGraph workflow (context, heuristics-first orchestrator, bounded planner, teacher, circuit and math agents, deterministic validator with one bounded retry, emit). Circuits are validated through `QiskitAerAdapter.validate`; all prompts are in `prompts.py`; at most 4 LLM calls per turn.
- **Whiteboard**: strict versioned action schema and the pure `apply_event` reducer (`app/schemas/whiteboard.py`); durable ordered events and snapshots (`whiteboard_events`, `whiteboard_snapshots`) with atomic sequence allocation, a run lease and supersede/late-event rejection (`classroom_sessions`).
- **Realtime**: `classroom:{session_id}` publishers with a cached channel and a ~100 ms token batcher. The tutor/circuit publishers are unchanged.
- **Persistence**: `AsyncPostgresSaver` checkpointer (`CHECKPOINT_DATABASE_URL`, opened in the lifespan, degrades to no checkpointer with a warning). New deps `langgraph-checkpoint-postgres`, `psycopg[binary,pool]`.
- **Migration `f6a7b8c9d0e1`** (additive): three new tables with RLS enabled; `agent_messages.agent_name/turn_id/client_message_id` with UNIQUE(session_id, client_message_id).

### Fixed — docs drift

- `docs/agents.md`, `docs/database.md` and `backend/design.md` no longer claim a `metadata` column on `agent_messages`/`document_chunks`, an IVFFlat index (it is HNSW), or a checkpointer for every agent (only the classroom graph uses one).

### Added — Payload CMS curriculum store

- **`cms/`**: a standalone Payload 3.90.2 / Next.js 16 app. It has the Curriculums → Levels → Modules → Lessons collections with drafts and versions, the closed 10-block lesson registry stored as JSONB (`blocksAsJSON`), Media with the Supabase Storage (S3) adapter, and isolated `cmsUsers` with `author`/`publisher` roles. It lives in its own `payload` Postgres schema, managed by migrations only.
- **Backend**: `POST /api/v1/internal/content-refs` (`X-CMS-Secret`) and `ContentRefService.register`. Publishing a lesson mints its `content_refs` id, or binds a legacy `legacy:<uuid>` ref. New `CMS_WEBHOOK_SECRET` setting.
- **Legacy migration**: `backend/scripts/export_legacy_curriculum.py` and `cms/scripts/import-legacy.ts`. The import is idempotent, validates every converted lesson, and keeps legacy lesson ids so existing progress carries over.
- **Frontend**: `NEXT_PUBLIC_CONTENT_SOURCE=cms` reads published curriculum from Payload through cached `/api/cms/*` route handlers. `POST /api/revalidate` refreshes that cache on publish. A lesson block renderer registry (`components/learn/blocks/`) covers all 10 block types, including interactive quiz and simulation blocks. Authored quiz blocks feed `/quiz`.

### Changed

- Frontend `GateSpec` now includes `params`, matching the backend.

### Added — Marketing Home Page (PR #21, 2026-09-21)

- **Marketing landing page** at `/` — replaces the redirect-only `app/page.tsx` with a fully assembled public surface. Unauthenticated visitors see the landing page; authenticated users are redirected to `/dashboard` via a `qlearn-auth` cookie check on mount.
- **`Navbar`** (`components/home/Navbar.tsx`) — sticky translucent nav (`backdrop-blur-md`, `bg-background/60`), Q-Learn wordmark, anchor links (`#features`, `#how-it-works`, `#pricing`), desktop Sign In + Get Started CTAs, mobile hamburger Sheet (shadcn `Sheet`).
- **`HeroCircuitSVG`** (`components/home/HeroCircuitSVG.tsx`) — accessible static SVG: H–CNOT–Measure two-qubit circuit using `globals.css` CIRCUIT PALETTE tokens (`--gate-H` purple, `--gate-CX` blue, `--gate-M` cyan). Measurement gates pulse via CSS `@keyframes`; pulse suppressed under `prefers-reduced-motion`.
- **`HeroSection`** (`components/home/HeroSection.tsx`) — full-viewport section: `ParticleNetwork` background, eyebrow badge, `ShimmerText` headline, sub-copy, primary `MagneticButton` + outline `Button` CTAs, and the circuit SVG inside a `GlowingBorder` card.
- **`FeatureCard`** (`components/home/FeatureCard.tsx`) — thin `SpotlightCard` wrapper with Lucide icon slot, title, description, and per-card accent/border class props.
- **`FeaturesSection`** (`components/home/FeaturesSection.tsx`) — 6-card `StaggerContainer` grid (1→2→3 col) covering Circuit Builder, AI Tutor, Real Simulator, Adaptive Quizzes, State Visualization, and Structured Curriculum.
- **`ProbabilityMockSVG`** (`components/home/ProbabilityMockSVG.tsx`) — accessible static SVG: `|00⟩ 50%` / `|11⟩ 50%` probability histogram using design-system accent colors.
- **`HowItWorksSection`** (`components/home/HowItWorksSection.tsx`) — 4 alternating text/visual rows: Follow Curriculum · Design Circuits · Run Simulator · Watch Mastery. Visuals are inline mockup components (`LessonMockup`, `HeroCircuitSVG`, `ProbabilityMockSVG`, `MasteryMockup`) — no screenshots or external images.
- **`StatsSection`** (`components/home/StatsSection.tsx`) — 4-stat bar (10,000+ Learners · 40+ Lessons · 3 Quantum algorithms · 1 AI Tutor per student) with `MeshGradient` background.
- **`PricingSection`** (`components/home/PricingSection.tsx`) — Free / Pro card pair (`Card` + `SpotlightCard`), "See full pricing →" link to `/pricing`, SIH2614 badge in `GlowingBorder`.
- **`HomeFooter`** (`components/home/HomeFooter.tsx`) — 3-column minimal footer: `© 2026 Q-Learn` · Privacy / Terms / GitHub links · tagline.

### Fixed — Marketing Home Page (PR #21)
- Footer copyright year corrected to 2026.
- `HeroCircuitSVG` measurement gate pulse wrapped with `@media (prefers-reduced-motion: reduce)` guard so the animation is suppressed for users who have opted out.
- Dead links in Navbar and Footer replaced with live routes or valid anchor targets.
- SVG gate colors aligned strictly to CIRCUIT PALETTE tokens; no raw hex in `className`.

---

### Added — IDE Shell & Auth

- **IDE shell (Slice 0)** — persistent VS Code-style shell mounted via a Next.js route group `app/(shell)/layout.tsx` → `AppShell`. Six always-mounted zones (`components/shell/`): `TitleBar` (breadcrumb + XP bar + user menu), `ActivityBar` (pathname-derived active nav), WorkspaceArea, collapsible `RightPanel` (Ctrl+B) and `BottomPanel` (Ctrl+J, results tab bar), `StatusBar` (backend health dot). Workspace routes (`dashboard/learn/circuit/code/quiz/settings`) moved under the group and render `WorkspacePlaceholder` until their slices land; new `/code` route
- Shell wiring — `lib/workspaces.ts` shared nav model, `hooks/useKeyboardShortcuts.ts` (Ctrl+B/J/1–6), non-redirecting `useAuth().hydrate()` for session restore on refresh, `lib/utils.ts` `cn()` helper
- Design-system foundation — Geist Sans/Mono + JetBrains Mono fonts, added tokens (`--bg-hover`, `--gate-Y`, `--gate-Z`, `--wire`), `app/styles/animations.css` (with `prefers-reduced-motion` guard)
- Frontend test harness — Vitest + React Testing Library + jsdom in a dedicated `frontend/test/` tree (25 tests)
- `NEXT_PUBLIC_DEV_NO_AUTH` — dev-only flag to open every page without logging in; double-gated (only when `NODE_ENV != production` and the flag is `1`), so it never bypasses auth in production
- Google OAuth sign-in via Supabase Auth — `hooks/useAuth.ts` gains `loginWithGoogle` (`supabase.auth.signInWithOAuth`); new client callback route `app/auth/callback/page.tsx` completes the session; "Continue with Google" button on login and register pages. No backend changes — `_sync_user()` provisions the local user from the Supabase JWT `sub` for any provider
- Supabase project provisioned (`ap-southeast-1`, ref `gwljzmjsuznwsdnqxxwu`); cloud schema migrated to Alembic head `b2c3d4e5f6a7` with Row Level Security enabled on all `public` tables
- `SUPABASE_JWT_SECRET` config (`app/config.py`) — verifies Supabase-issued access tokens
- Backend Realtime publisher — `app/core/supabase.py` (service-role async client) and `app/services/realtime_service.py` (`publish_circuit_result`, `publish_tutor_token`)
- Frontend Supabase client + Realtime helpers (`lib/supabase.ts`) — `subscribeToCircuitResult`, `subscribeToTutorTokens`
- Alembic migrations: `hashed_password` made nullable (`a1b2c3d4e5f6`); enable RLS on all public tables (`b2c3d4e5f6a7`)
- `docs/onboarding.md` — team setup guide for getting the repo running against the shared Supabase project
- Auth layout (`app/auth/layout.tsx`) — full-viewport dark card shell shared by login and register pages
- Login page (`app/auth/login/`) — email/password form with error banner and link to register
- Register page (`app/auth/register/`) — email/password/display name form with confirm-password validation and auto-login on success
- `components/ui/Button.tsx` — primitive button with `primary`/`ghost` variants and loading state
- `components/ui/Input.tsx` — labeled input primitive with inline error display
- `hooks/useAuth.ts` — `useAuth` hook encapsulating login, register, and logout; manages JWT store and `qlearn-auth` session cookie
- `middleware.ts` — Next.js Edge middleware protecting dashboard/learn/circuit/quiz/settings routes; redirects authenticated users away from auth pages
- CSS design system tokens in `app/globals.css` — `:root` custom properties (`--bg-base`, `--bg-surface`, `--quantum`, `--error`, gate colors, text colors, etc.)
- `.eslintrc.json` — ESLint configuration using `next/core-web-vitals` ruleset

### Changed
- Auth migrated from custom JWT to **Supabase Auth**: the backend verifies Supabase access tokens (HS256) and syncs a local `public.users` row for role/subscription; the frontend signs in via `@supabase/supabase-js` (`hooks/useAuth.ts`)
- `database.py` is now pooler-aware — a port-`6543` (transaction pooler) `DATABASE_URL` disables asyncpg prepared statements and server-side pooling; local Docker (`5432`) is unchanged

### Removed
- Backend auth endpoints `POST /api/v1/auth/register`, `/login`, `/refresh` (handled by Supabase Auth on the client); `GET /api/v1/auth/me` retained

### Fixed
- Replaced unsupported `next.config.ts` with `next.config.mjs` (Next.js 14 does not support TypeScript config files)

## [0.1.0] - 2026-09-16

### Added
- Initial project scaffold: Next.js 14 App Router frontend with Tailwind CSS
- FastAPI backend with async SQLAlchemy and Alembic migrations
- Zustand stores: `authStore`, `learningStore`, `circuitStore`, `tutorStore`, `quizStore`, `billingStore`, `shellStore`
- `apiFetch<T>` API client in `lib/api.ts`
- Core TypeScript types: `User`, `Course`, `Module`, `Lesson`, `GateSpec`, `CircuitSpec`, `SimulationResult`, `Plan`
- Docker Compose configuration for local full-stack development
