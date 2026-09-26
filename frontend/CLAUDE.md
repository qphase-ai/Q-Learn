# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install (from frontend/)
pnpm install

# Dev server — http://localhost:3000
pnpm dev

# Type check
pnpm type-check          # tsc --noEmit

# Tests (Vitest + RTL + jsdom) — specs live in frontend/test/ mirroring src/
pnpm test                # run once
pnpm test:watch          # watch mode

# Lint
pnpm lint                # next lint

# Production build
pnpm build
pnpm start
```

Docker Compose runs the full stack (postgres + api + web) from the repo root:
```bash
docker compose up --build
```

---

## Architecture

The UI is built on a shared **`LabShell`** chrome component (`components/dashboard/LabShell.tsx`) that each top-level route mounts directly — `/dashboard`, `/learn`, `/circuit`, `/code`, and `/quiz` each render their own `LabShell` instance (there is no single app-wide shell mounted from the root layout). `LabShell` renders `DashboardHeader` + `DashboardActivityBar` + an optional `CurriculumSidebar` + its `children` render-prop (passed an `LabShellChildContext` with `onExplainCircuit`) + an optional `DashboardTutorPanel`. Three props drive layout variants:
- `sidebarCollapsed` — hides `CurriculumSidebar` when true
- `tutorCollapsed` — hides `DashboardTutorPanel` when true
- `activityBarDim` — dims `DashboardActivityBar`

`/quiz` sets all three of `sidebarCollapsed`/`tutorCollapsed`/`activityBarDim` for its focus-mode layout (no sidebar, no tutor column, dimmed activity bar). `/dashboard`, `/learn`, `/circuit`, `/code` use the default (expanded) layout.

Inside `LabShell`'s children, `/dashboard` renders the full `CentralWorkspace` with its tab switcher (Lesson/Circuit/Code/Simulation/Practice), while `/learn`, `/circuit`, and `/code` each pass a `lockedTab` prop to `CentralWorkspace` (`"lesson"`, `"circuit"`, `"code"` respectively) so only that one tab renders full-height with no tab switcher (`showTabBar` defaults to `lockedTab === undefined`).

### Source layout (`src/`)

| Path | Purpose |
|------|---------|
| `app/` | Next.js 14 App Router — page files only, no component logic here |
| `app/layout.tsx` | Root layout — fonts, `Providers`; does not mount any shell (each route mounts its own `LabShell`) |
| `app/auth/` | Login / Register / Forgot-password pages |
| `app/dashboard/`, `learn/`, `circuit/`, `code/`, `quiz/`, `pricing/`, `settings/` | Route entry points |
| `components/dashboard/` | `LabShell`, `CentralWorkspace`, `DashboardHeader`, `DashboardActivityBar`, `CurriculumSidebar`, `DashboardTutorPanel`, `FileTreePanel`, `MonacoCodePanel`, `CircuitResultsPanel`, `DashboardWorkspace`, and other dashboard-owned pieces |
| `components/circuit/` | React Flow circuit builder — `GateNode`, `QubitWireNode`, `MeasurementNode`, `GatePalette`, `CircuitCanvas`, `CircuitToolbar` |
| `components/quiz/` | `QuizWorkspace` + its children — `QuizProgressBar`, `QuestionDisplay`, `AnswerOptions`, `HintButton`, `QuizNavigation` |
| `components/tutor/` | `AITutorPanel` — streaming chat, citation badges, KaTeX math |
| `components/visualization/` | `ProbabilityChart`, `StateVectorTable`, `QASMViewer`, `ConsoleOutput` — rendered inline (e.g. inside `CircuitResultsPanel`), not in a separate bottom panel |
| `components/ui/` | Primitive atoms (Button, Badge, etc.) — accessibility baseline via shadcn/ui |
| `stores/` | Zustand stores — one per domain |
| `hooks/` | Custom React hooks wrapping store + API logic |
| `lib/api.ts` | `apiFetch<T>` — all FastAPI calls go through here |
| `lib/supabase.ts` | Supabase client + Realtime channel subscriptions |
| `types/index.ts` | Shared TypeScript types (`User`, `Course`, `GateSpec`, `SimulationResult`, `Plan`, …) |

### LabShell zones

| Zone | Content |
|------|---------|
| `DashboardHeader` | Top bar — brand, search, backend status, theme toggle, user menu |
| `DashboardActivityBar` | Left rail — nav items Learn / Circuits / Code / Practice / Progress / AI Tutor, plus Docs / Feedback / Settings utility icons; dims when `activityBarDim` is set (quiz focus mode). No separate "Dashboard" nav entry — `/dashboard` isn't linked from the activity bar. |
| `CurriculumSidebar` | Left complementary panel — course/module/lesson tree; omitted when `sidebarCollapsed` |
| Center content (`children`) | The route's main content — `CentralWorkspace` for `/dashboard`/`/learn`/`/circuit`/`/code`, `QuizWorkspace` for `/quiz` |
| `DashboardTutorPanel` | Right complementary panel — AI Tutor chat/hints/next-step tabs; omitted when `tutorCollapsed` |

There is no separate `BottomPanel`/`StatusBar`/`TutorFAB` zone anymore — simulation results render inline where needed (`CircuitResultsPanel` in `CentralWorkspace`'s lesson/circuit/code/simulation tabs), and there's no floating tutor FAB. The tutor panel's visibility is a `LabShell` prop (`tutorCollapsed`), not shell-store state — `useShellStore`'s `tutorOpen`/`toggleTutor` are dead (nothing reads `tutorOpen`; only `tutorStore.sendMessage` writes it, as a no-op).

---

## Zustand Stores

Each store owns one domain. **No store imports from another.** Cross-domain reads are snapshots at call time, not reactive subscriptions.

| Store | File | Persisted keys |
|-------|------|---------------|
| `useShellStore` | `shellStore.ts` | none — only holds `activeWorkspace`/`tutorOpen` (+ `setWorkspace`/`toggleTutor`); the `persist` wrapper was removed |
| `useAuthStore` | `authStore.ts` | `jwt` only |
| `useLearningStore` | `learningStore.ts` | `lessonProgress`, `xp`, `streak` |
| `useCircuitStore` | `circuitStore.ts` | none (session-only) |
| `useTutorStore` | `tutorStore.ts` | none (session-only) |
| `useQuizStore` | `quizStore.ts` | none (session-only) |

### Key cross-store flows

- Quiz submitted → `useQuizStore.setScore` → call `useLearningStore.updateMastery`
- Circuit run succeeds → `useCircuitStore.setResults`; the result renders inline via `CircuitResultsPanel` wherever it's mounted (no shell-level panel toggle needed)
- Tutor message sent → reads `useLearningStore.currentLessonId` as snapshot for context
- Quiz workspace entered → `/quiz` mounts `LabShell` with `sidebarCollapsed`/`tutorCollapsed`/`activityBarDim` all set — the focus-mode layout is a prop passed to `LabShell`, not shell store state

---

## API Client

All backend calls use `apiFetch<T>` in `lib/api.ts`:

```ts
import { apiFetch } from "@/lib/api";

const data = await apiFetch<Course[]>("/api/v1/courses", { token: jwt });
```

- Base URL: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`)
- Attaches `Authorization: Bearer <token>` when `token` is provided
- Throws on `!res.ok` or `json.success === false` with the backend error message
- Returns `json.data` — matches the backend `{ success, data }` envelope

---

## Realtime (Supabase)

**Never poll the API for circuit results or tutor tokens.** Subscribe to Supabase Realtime channels via `lib/supabase.ts`.

```ts
// Circuit result — subscribe in CircuitCanvas
supabase.channel(`circuit:${circuitId}`)
  .on("broadcast", { event: "result" }, ({ payload }) => {
    circuitStore.setResults(payload);   // CircuitResultsPanel re-renders inline
  })
  .subscribe();

// AI Tutor token streaming — subscribe in AITutorPanel
supabase.channel(`tutor:${sessionId}`)
  .on("broadcast", { event: "token" }, ({ payload }) =>
    tutorStore.addMessage({ ...partialMsg, content: partialMsg.content + payload.token }))
  .subscribe();
```

Unsubscribe on component unmount to avoid leaking channels.

---

## Circuit Builder

- Canvas: `@xyflow/react` (React Flow) with custom node types
- Node types: `GateNode` · `QubitWireNode` · `MeasurementNode`
- Gates are HTML5 drag sources from `GatePalette`; drop onto a wire creates a node
- Circuit state (`nodes`, `edges`) lives entirely in `useCircuitStore` — React Flow's `onNodesChange` / `onEdgesChange` must call `setNodes` / `setEdges`
- Running a circuit: POST circuit definition to `/api/v1/circuits/{id}/execute`, then await Supabase Realtime `result` event
- Results render inline via `CircuitResultsPanel` (in `CentralWorkspace`'s lesson/circuit/code/simulation tabs) — a fixed layout, not tabs: a measurement-probability chart (`ProbabilityChart`) + state-vector table (`StateVectorTable`) side by side with a Bloch-sphere visualization (`StateSphereVisualization`) and a key-insight callout. `QASMViewer` exists under `components/visualization/` but isn't wired into `CircuitResultsPanel`.

---

## Design System Constraints

Dark cyberpunk / glassmorphism aesthetic. Core tokens are HSL triplets defined in `src/app/globals.css` (`:root`), consumed via Tailwind's `hsl(var(--x) / <alpha-value>)` pattern in `tailwind.config.ts` and exposed as semantic Tailwind classes. **Do not hardcode colors or read the CSS vars directly — use the Tailwind semantic classes.**

| Token (CSS var) | Approx. value | Tailwind class | When to use |
|------|------|-----------------|-------------|
| `--background` | `#050505` (0 0% 2%) | `bg-background` | Root background |
| `--surface` | 0 0% 4% | `bg-surface` | Panels, cards |
| `--elevated` | 0 0% 7% | `bg-elevated` | Dropdowns, tooltips, popovers |
| `--border-ds` | 0 0% 100% (low-alpha) | `border-border` | All borders (use with opacity, e.g. `border-white/10`) |
| `--foreground` | 0 0% 96% | `text-foreground` | Primary text |
| `--muted-foreground` | 0 0% 60% | `text-muted-foreground` | Secondary text |
| `--cyber-cyan` | `#00F0FF` | `text-cyber-cyan` / `bg-cyber-cyan` (+ 50–950 shade ramp) | Primary accent — CTAs, active states, links |
| `--electric-purple` | `#B026FF` | `text-electric-purple` / `bg-electric-purple` (+ 50–950 shade ramp) | Secondary accent |
| `--neon-green` | `#39FF14` | `text-neon-green` / `bg-neon-green` (+ 50–950 shade ramp) | Tertiary accent, success highlight |
| `--success-ds` | 142 71% 45% | `text-success` / `bg-success` | Correct, passed |
| `--warning-ds` | 38 92% 50% | `text-warning` / `bg-warning` | Partial mastery, hints |
| `--error-ds` | 0 91% 65% | `text-error` / `bg-error` | Wrong answers, errors |

`globals.css` also keeps a **LEGACY DESIGN TOKENS** block (`--bg-base`, `--quantum`, etc.) alive for old components not yet migrated — don't build new UI against it; it is slated for removal once all consumers move to the tokens above.

Gate palette (`src/app/globals.css`, "CIRCUIT PALETTE — DO NOT MODIFY") — unchanged, still consumed directly by circuit builder node components:

| Token | Value | When to use |
|-------|-------|-------------|
| `--gate-H` | `#8b5cf6` | Hadamard gate |
| `--gate-X` | `#f85149` | Pauli-X gate |
| `--gate-CX` | `#3b82f6` | CNOT gate |
| `--gate-M` | `#00d4ff` | Measurement gate |

**Depth & glow:** `backdrop-blur-md`/`backdrop-blur-xl` + translucent `border-white/10` and `bg-white/[x]` fills for glassmorphic panels; `shadow-glow-{cyan,purple,green}` (and `shadow-glow-cyan-lg`, `shadow-glow-inner`) utilities for accent glows — `box-shadow` is a core technique here, not banned.  
**Motion:** Framer Motion micro-interactions (`whileHover`/`whileTap`) expected on interactive elements; anything animated must respect `prefers-reduced-motion` (see `useReducedMotion()` usage in `components/ui/button.tsx` and `components/motion/`).

**Component directories:**

| Path | Purpose |
|------|---------|
| `components/ui/` | shadcn/Radix + CVA primitives — `button`, `input`, `card`, `dialog`, `sheet`, `dropdown-menu`, `tooltip`, `tabs`, `badge`, `skeleton`, `separator`, `label`, `switch`, `avatar`, `progress`, `sonner` (toasts) |
| `components/motion/` | Framer Motion wrapper components — `FadeIn`, `SlideUp`, `StaggerChildren`, `PageTransition` |
| `components/backgrounds/` | Animated background primitives (CSS/SVG/canvas, no WebGL) — `AuroraBackground`, `ParticleNetwork`, `MeshGradient`, `GlowingOrbs`, `GridBackground`, `NoiseOverlay` |
| `components/effects/` | Composed visual effects built on the primitives above — `SpotlightCard`, `GlowingBorder`, `AnimatedBeam`, `ShimmerText`, `MagneticButton`, `TextReveal` |

---

## Component Rules

- Each workspace owns its child components — no cross-workspace imports
- Cross-workspace data flows only through Zustand stores
- Colocation: workspace-specific components live under `components/workspaces/<name>/` (per `design.md` target structure); currently scaffolded under `components/circuit/`, `components/tutor/`, etc.
- Math: render via KaTeX (`katex` or `react-katex`) — not MathJax
- Markdown: `remark` + `rehype` pipeline — supports custom directives for circuit embeds
- Monaco Editor: dynamic import only (not in initial bundle); use for Code Editor workspace

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | FastAPI backend base URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_DEV_NO_AUTH` | Dev-only: `1` opens every page without login (ignored in production; double-gated on `NODE_ENV`) |

Copy `frontend/.env.local.example` → `frontend/.env.local`. Full reference: `../docs/infrastructure.md`.

---

## Keyboard Shortcuts

Circuit-canvas shortcuts only (`hooks/useCircuitShortcuts.ts`) — there is no longer an app-wide shortcut hook (`useKeyboardShortcuts` was retired along with `AppShell`; it drove `Ctrl+B`/`Ctrl+J`/`Ctrl+1…6` for the old TutorFAB/BottomPanel/workspace-switcher, none of which exist anymore). The hook takes an `enabled` flag and is called from `CentralWorkspace`, active only when `lockedTab === "circuit"` (i.e. on the standalone `/circuit` route) — not when the circuit tab is just one of several visible in the embedded `/dashboard` preview:

| Shortcut | Action |
|----------|--------|
| `Space` (circuit canvas) | Run simulation |
| `Delete` (circuit canvas) | Remove selected gate |
| `H / X / C / M` (circuit canvas) | Place H / X / CX / Measurement gate |
