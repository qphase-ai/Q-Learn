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

The UI is a **persistent VS Code-style IDE shell** (`AppShell`) that mounts once. Navigation swaps only the `WorkspaceArea` — the surrounding chrome never re-renders.

### Source layout (`src/`)

| Path | Purpose |
|------|---------|
| `app/` | Next.js 14 App Router — page files only, no component logic here |
| `app/layout.tsx` | Root layout — mounts `AppShell` |
| `app/auth/` | Login / Register / Forgot-password pages |
| `app/dashboard/`, `learn/`, `circuit/`, `quiz/`, `pricing/`, `settings/` | Route entry points |
| `components/shell/` | IDE shell — `AppShell` + zones (`TitleBar`, `ActivityBar`, `RightPanel`, `BottomPanel`, `StatusBar`, `WorkspacePlaceholder`) |
| `components/circuit/` | React Flow circuit builder — `GateNode`, `QubitWireNode`, `MeasurementNode`, `GatePalette`, `CircuitCanvas` |
| `components/tutor/` | `AITutorPanel` — streaming chat, citation badges, KaTeX math |
| `components/visualization/` | `ProbabilityChart`, `StateVectorTable`, `QASMViewer` (BottomPanel tabs) |
| `components/billing/` | Pricing, upgrade modal, subscription management |
| `components/ui/` | Primitive atoms (Button, Badge, etc.) — accessibility baseline via shadcn/ui |
| `stores/` | Zustand stores — one per domain |
| `hooks/` | Custom React hooks wrapping store + API logic |
| `lib/api.ts` | `apiFetch<T>` — all FastAPI calls go through here |
| `lib/supabase.ts` | Supabase client + Realtime channel subscriptions |
| `types/index.ts` | Shared TypeScript types (`User`, `Course`, `GateSpec`, `SimulationResult`, `Plan`, …) |

### Shell zones (6, always mounted)

| Zone | Size | Content |
|------|------|---------|
| TitleBar | 36px top | Breadcrumb + XP bar + user menu |
| ActivityBar | 48px left | Mode icons — `dashboard \| learn \| circuit \| code \| quiz \| settings` |
| WorkspaceArea | fills remainder | Active workspace, lazy-loaded |
| RightPanel | 380px right | `AITutorPanel` — `Ctrl+B` toggles |
| BottomPanel | 250px bottom | Simulation results / console — `Ctrl+J` toggles |
| StatusBar | 24px bottom | Current level · mastery · backend status |

---

## Zustand Stores

Each store owns one domain. **No store imports from another.** Cross-domain reads are snapshots at call time, not reactive subscriptions.

| Store | File | Persisted keys |
|-------|------|---------------|
| `useShellStore` | `shellStore.ts` | `rightPanelOpen`, `bottomPanelOpen` |
| `useAuthStore` | `authStore.ts` | `jwt` only |
| `useLearningStore` | `learningStore.ts` | `lessonProgress`, `xp`, `streak` |
| `useCircuitStore` | `circuitStore.ts` | none (session-only) |
| `useTutorStore` | `tutorStore.ts` | none (session-only) |
| `useQuizStore` | `quizStore.ts` | none (session-only) |
| `useBillingStore` | `billingStore.ts` | — |

### Key cross-store flows

- Quiz submitted → `useQuizStore.setScore` → call `useLearningStore.updateMastery`
- Circuit run succeeds → `useCircuitStore.setResults` + open BottomPanel via `useShellStore`
- Tutor message sent → reads `useLearningStore.currentLessonId` as snapshot for context
- Quiz workspace entered → `useShellStore.setFocusMode(true)` — collapses both panels

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
    circuitStore.setResults(payload);
    shellStore.toggleBottomPanel();   // open on result
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
- BottomPanel tabs for results: **Probabilities** · **State Vector** · **QASM**

---

## Design System Constraints

All tokens are defined in `src/app/globals.css` as CSS custom properties. **Do not hardcode colors.**

| Token | Value | When to use |
|-------|-------|-------------|
| `--bg-base` | `#0d0d0d` | Root background |
| `--bg-surface` | `#141414` | Panels, cards |
| `--bg-elevated` | `#1a1a1a` | Dropdowns, tooltips |
| `--border` | `#2a2a2a` | All borders |
| `--quantum` | `#00d4ff` | Primary accent — active states, CTAs |
| `--quantum-dim` | `#00d4ff26` | Glow backgrounds, selections |
| `--success` | `#3fb950` | Correct, passed |
| `--warning` | `#d29922` | Partial mastery, hints |
| `--error` | `#f85149` | Wrong answers, errors |
| `--gate-H` | `#8b5cf6` | Hadamard gate |
| `--gate-X` | `#f85149` | Pauli-X gate |
| `--gate-CX` | `#3b82f6` | CNOT gate |
| `--gate-M` | `#00d4ff` | Measurement gate |

**No `box-shadow`.** Depth via `--border` and `--quantum` glow (`0 0 8px #00d4ff40`) only.  
**Active nav states:** `--quantum` 2px left border — never background fills.

---

## Component Rules

- Each workspace owns its child components — no cross-workspace imports
- Cross-workspace data flows only through Zustand stores
- Colocation: workspace-specific components live under `components/workspaces/<name>/` (per `design.md` target structure); currently scaffolded under `components/circuit/`, `components/tutor/`, etc.
- Math: render via KaTeX (`katex` or `react-katex`) — not MathJax
- Markdown: `remark` + `rehype` pipeline — supports custom directives for circuit embeds
- Monaco Editor: dynamic import only (not in initial bundle); use for Code Editor workspace

---

## Pro Gating

`user.subscription_status === "pro"` gates AI Tutor, circuit execution, and adaptive quizzes. Check via `useAuthStore`. Show upgrade modal (from `components/billing/`) on denied access. Never gate lessons or curriculum content.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | FastAPI backend base URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key (client-side, public) |
| `NEXT_PUBLIC_DEV_NO_AUTH` | Dev-only: `1` opens every page without login (ignored in production; double-gated on `NODE_ENV`) |

Copy `frontend/.env.local.example` → `frontend/.env.local`. Full reference: `../docs/infrastructure.md`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle RightPanel (AI Tutor) |
| `Ctrl+J` | Toggle BottomPanel (Simulation / Console) |
| `Ctrl+1…6` | Switch workspace by index |
| `Space` (circuit canvas) | Run simulation |
| `Delete` (circuit canvas) | Remove selected gate |
| `H / X / C / M` (circuit canvas) | Place H / X / CX / Measurement gate |
