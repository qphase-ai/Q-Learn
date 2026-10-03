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
| `components/circuit/` | Circuit lab — `CircuitWorkspace` (layout) composing `library/GateLibrary` + `GateCard`, `CircuitToolbar`, `CircuitCanvas` (React Flow; `nodes/` GateNode · MeasurementNode · QubitWireNode · ClassicalWireNode · CellGridNode), `GateInspector`, `analysis/` (StateVector · BlochSphere · MeasurementResults panels) |
| `components/quiz/` | `QuizWorkspace` + its children — `QuizProgressBar`, `QuestionDisplay`, `AnswerOptions`, `HintButton`, `QuizNavigation` |
| `components/tutor/` | `AITutorPanel` — streaming chat, citation badges, KaTeX math |
| `components/visualization/` | `ProbabilityChart`, `StateVectorTable`, `QASMViewer`, `ConsoleOutput` — rendered inline (e.g. inside `CircuitResultsPanel`), not in a separate bottom panel |
| `components/ui/` | Primitive atoms (Button, Badge, etc.) — accessibility baseline via shadcn/ui |
| `stores/` | Zustand stores — one per domain |
| `hooks/` | Custom React hooks wrapping store + API logic |
| `lib/api.ts` | `apiFetch<T>` — all FastAPI calls go through here |
| `lib/content-source.ts` | `NEXT_PUBLIC_CONTENT_SOURCE` flag + client reads of `/api/cms/*` |
| `lib/cms.ts` | Server-only Payload reads (cached, tag-revalidated) and Payload → `CourseDetail`/`LessonDetail` mapping |
| `app/api/cms/*`, `app/api/revalidate` | Route handlers: published curriculum from Payload; on-publish cache invalidation |
| `components/learn/blocks/` | Lesson block registry — one renderer per CMS block type (mirrors `cms/src/blocks/lessonBlocks.ts`) |
| `lib/supabase.ts` | Supabase client + Realtime channel subscriptions |
| `types/index.ts` | Shared TypeScript types (`User`, `Course`, `GateSpec`, `SimulationResult`, `Plan`, …) |

### LabShell zones

| Zone | Content |
|------|---------|
| `DashboardHeader` | Top bar — brand, lesson search (`LessonSearch`: `GET /api/v1/search/lessons`, or a title match over the active course when `NEXT_PUBLIC_CONTENT_SOURCE=cms`; `⌘K`/`Ctrl+K` focuses it), backend status, theme toggle, user menu |
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

- `CircuitWorkspace` is the whole circuit lab (used by `CentralWorkspace`'s circuit tab): gate library | toolbar / canvas (+ floating `GateInspector`) / status bar / `CircuitAnalysis`. Layout is driven by the workspace's **own width** (`useElementWidth`), not viewport breakpoints, because LabShell's side panels decide how much room it gets
- Gate metadata (symbol, name, description, colour, params, KaTeX matrix) lives in one catalog: `lib/gates.ts`. Add a gate there, in `GateType`, and in the backend's `QiskitAerAdapter._spec_to_qasm`
- Canvas: `@xyflow/react` with custom node types. Wires, the classical register and the cell grid are ephemeral frame nodes derived from `qubitCount` (they carry explicit `width`/`height` because their dimension changes are not stored)
- Gate cards are HTML5 drag sources (`application/gate-type`); the canvas previews the landing cell during drag-over. Clicking a card "arms" it (`selectedGateType`) for click / keyboard placement
- Circuit state lives entirely in `useCircuitStore`. Editing actions (`placeGate`, `moveGate`, `updateGate`, `duplicateSelected`, `removeSelected`, `setQubitCount`, `clearCircuit`, …) push undo history; `setNodes` (selection/drag frames) does not. Occupied cells shift placements to the next free column
- Running a circuit: POST circuit definition (with `params` for parametric gates and the selected `shots`) to `/api/v1/circuits/{id}/execute`, then await Supabase Realtime `result` event
- On the circuit tab, results render in `CircuitAnalysis` (state vector, a true reduced Bloch vector per qubit from `lib/quantum-state.ts`, measurement bars). Lesson/code/simulation tabs still use `CircuitResultsPanel`

---

## Design System Constraints

Cyberpunk / glassmorphism aesthetic with **light and dark themes** (dark is the default). Core tokens are HSL triplets defined in `src/app/globals.css` — light values on `:root`, dark values on `.dark` — consumed via Tailwind's `hsl(var(--x) / <alpha-value>)` pattern in `tailwind.config.ts` and exposed as semantic Tailwind classes. **Do not hardcode colors or read the CSS vars directly — use the Tailwind semantic classes**, or the UI will break in one of the two themes. In particular, never use `white/…`/`black/…` for translucent fills or borders; use `overlay/…` (white in dark, black in light).

**Theming:** `next-themes` (`ThemeProvider` in `app/providers.tsx`, `attribute="class"`, `defaultTheme="dark"`, `enableSystem`) sets `light`/`dark` on `<html>` before paint and persists the choice in `localStorage` (`theme`). Users switch via `ThemeToggle` (`components/ui/theme-toggle.tsx`, in `DashboardHeader`) or the Light/Dark/System picker in Settings. Read the theme with `useTheme()`; anything rendering theme-specific markup must wait for `useMounted()` (`hooks/useMounted.ts`) to avoid hydration mismatches. Third-party widgets follow `resolvedTheme` (Sonner toasts in `components/ui/sonner.tsx`, Monaco `light`/`vs-dark` in `MonacoCodePanel`).

Values below are dark / light.

| Token (CSS var) | Approx. value | Tailwind class | When to use |
|------|------|-----------------|-------------|
| `--background` | `#050505` / `#f7f7f7` | `bg-background` | Root background |
| `--surface` | 0 0% 4% / white | `bg-surface` | Panels, cards |
| `--elevated` | 0 0% 7% / white | `bg-elevated` | Dropdowns, tooltips, popovers |
| `--overlay` | white / black (always with opacity) | `bg-overlay/5`, `border-overlay/10`, `hover:bg-overlay/5` | Glass fills, hover states, hairline borders and dividers |
| `--border-ds` | white / black | `border-border` | Full-strength only — for dividers use `border-overlay/10` |
| `--foreground` | 0 0% 96% / 0 0% 9% | `text-foreground` | Primary text |
| `--muted-foreground` | 0 0% 60% / 0 0% 38% | `text-muted-foreground` | Secondary text |
| `--cyber-cyan` | `#00F0FF` / `#0b7490`-ish | `text-cyber-cyan` / `bg-cyber-cyan` | Primary accent — CTAs, active states, links |
| `--electric-purple` | `#B026FF` / `#7e22ce`-ish | `text-electric-purple` / `bg-electric-purple` | Secondary accent |
| `--neon-green` | `#39FF14` / `#15803d`-ish | `text-neon-green` / `bg-neon-green` | Tertiary accent, success highlight |
| `--success-ds` | 142 71% 45% / 142 72% 29% | `text-success` / `bg-success` | Correct, passed |
| `--warning-ds` | 38 92% 50% / 32 95% 36% | `text-warning` / `bg-warning` | Partial mastery, hints |
| `--error-ds` | 0 91% 65% / 0 72% 45% | `text-error` / `bg-error` | Wrong answers, errors |

The accent `DEFAULT`s are theme-aware (darkened in light mode for ≥4.5:1 contrast); their numbered 50–950 ramps are fixed hex and do **not** change with the theme.

`globals.css` also keeps a **LEGACY DESIGN TOKENS** block (`--bg-base`, `--quantum`, etc., with light and dark values) alive for old components not yet migrated — don't build new UI against it; it is slated for removal once all consumers move to the tokens above.

Gate palette (`src/app/globals.css`, "CIRCUIT PALETTE — DO NOT MODIFY") — identical in both themes, consumed directly by circuit builder node components. Because the fills don't change, their labels use the fixed `--gate-label` (light) / `--gate-label-on-light` (dark, for the cyan measurement gate) from the "CIRCUIT LABELS" block, not theme tokens:

| Token | Value | When to use |
|-------|-------|-------------|
| `--gate-H` | `#8b5cf6` | Hadamard gate |
| `--gate-X` | `#f85149` | Pauli-X gate |
| `--gate-CX` | `#3b82f6` | CNOT gate |
| `--gate-M` | `#00d4ff` | Measurement gate |

**Depth & glow:** `backdrop-blur-md`/`backdrop-blur-xl` + translucent `border-overlay/10` and `bg-overlay/[x]` fills for glassmorphic panels; `shadow-glow-{cyan,purple,green}` (and `shadow-glow-cyan-lg`, `shadow-glow-inner`) utilities for accent glows — `box-shadow` is a core technique here, not banned.  
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
| `NEXT_PUBLIC_CONTENT_SOURCE` | `legacy` (default, FastAPI `/api/v1/courses`) or `cms` (Payload via `/api/cms/*`) |
| `CMS_URL` | Server-only — Payload CMS origin read by `lib/cms.ts` |
| `REVALIDATE_SECRET` | Server-only — shared secret the CMS sends to `POST /api/revalidate` |

Copy `frontend/.env.local.example` → `frontend/.env.local`. Full reference: `../docs/infrastructure.md`.

---

## Keyboard Shortcuts

Besides `⌘K`/`Ctrl+K` (focus the header lesson search, handled in `LessonSearch`), these are circuit-canvas shortcuts only (`hooks/useCircuitShortcuts.ts`) — there is no longer an app-wide shortcut hook (`useKeyboardShortcuts` was retired along with `AppShell`; it drove `Ctrl+B`/`Ctrl+J`/`Ctrl+1…6` for the old TutorFAB/BottomPanel/workspace-switcher, none of which exist anymore). The hook takes an `enabled` flag and is called from `CentralWorkspace`, active only when `lockedTab === "circuit"` (i.e. on the standalone `/circuit` route) — not when the circuit tab is just one of several visible in the embedded `/dashboard` preview:

| Shortcut | Action |
|----------|--------|
| `Space` | Run simulation |
| `Delete` / `Backspace` | Remove selected gate |
| `H / X / C / M` | Arm H / X / CX / Measurement gate for placement |
| `Esc` | Cancel placement, then deselect |
| `Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z` or `Ctrl+Y` | Undo / redo |
| `Ctrl/⌘+D` | Duplicate selected gate |
| Arrow keys | Move selected gate one cell |
| `/` | Focus gate search |