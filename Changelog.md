# Changelog

All notable changes to Q-Learn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
