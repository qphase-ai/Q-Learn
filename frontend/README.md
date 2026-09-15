# Q-Learn Frontend

Next.js 14 frontend for the Q-Learn adaptive quantum computing education platform.

**Stack:** Next.js 14 (App Router) · TypeScript · React 18 · Tailwind CSS · Zustand · React Flow · Supabase JS

---

## Quick Start

### With Docker Compose (recommended)

From the **repo root**:

```bash
cp .env.example .env
docker compose up --build
```

Frontend at `http://localhost:3000`.

### Local

```bash
cd frontend
pnpm install
cp .env.local.example .env.local    # fill in variables
pnpm dev
```

Requires the FastAPI backend running at `http://localhost:8000`. See the repo root `docker-compose.yml` or `../docs/infrastructure.md`.

---

## Project Structure

```
frontend/src/
├── app/                    # Next.js App Router — page files only
│   ├── layout.tsx          # Root layout — mounts AppShell
│   ├── page.tsx            # Auth redirect
│   ├── auth/               # Login / Register / Forgot-password
│   ├── dashboard/
│   ├── learn/
│   ├── circuit/
│   ├── quiz/
│   ├── pricing/
│   └── settings/billing/
│
├── components/
│   ├── circuit/            # React Flow circuit builder, gate nodes, palette
│   ├── tutor/              # AI Tutor panel — streaming chat, citations, KaTeX
│   ├── visualization/      # Probability chart, state vector table, QASM viewer
│   ├── billing/            # Pricing page, upgrade modal, subscription management
│   └── ui/                 # Primitive atoms (Button, Badge, etc.)
│
├── stores/                 # Zustand stores — one per domain
├── hooks/                  # Custom React hooks
├── lib/
│   ├── api.ts              # apiFetch<T> — all FastAPI calls
│   └── supabase.ts         # Supabase client + Realtime subscriptions
└── types/
    └── index.ts            # Shared TypeScript types
```

---

## Shell Architecture

The UI is a **persistent VS Code-style IDE shell** that mounts once. Navigation swaps only the center workspace — the surrounding chrome never re-renders.

### 6 Zones

| Zone | Size | Content |
|------|------|---------|
| TitleBar | 36px top | Breadcrumb + XP progress bar + user menu |
| ActivityBar | 48px left | Mode switcher icons |
| WorkspaceArea | fills remainder | Active workspace, lazy-loaded |
| RightPanel | 380px right | AI Tutor — `Ctrl+B` to toggle |
| BottomPanel | 250px bottom | Simulation results / console — `Ctrl+J` to toggle |
| StatusBar | 24px bottom | Current level · mastery score · backend status |

### 6 Workspace Modes

| Mode | ActivityBar | Description |
|------|-------------|-------------|
| Dashboard | 1 | Learning path, skill mastery, next activity |
| Learn | 2 | Lesson content with inline circuit previews |
| Circuit Builder | 3 | Drag-and-drop quantum circuit builder |
| Code Editor | 4 | Monaco editor for Qiskit Python challenges |
| Quiz | 5 | Distraction-free assessment (Focus Mode) |
| Settings | 6 | Profile, billing, preferences |

**Focus Mode** activates during quiz: ActivityBar dims to 30% opacity, both panels collapse. Restored on quiz exit.

---

## State Management

Seven Zustand stores. Each owns one domain — no cross-store imports.

| Store | Persisted | Description |
|-------|-----------|-------------|
| `useShellStore` | panel states | Active workspace, panel open/close, focus mode |
| `useAuthStore` | `jwt` only | Authenticated user, JWT token |
| `useLearningStore` | `lessonProgress`, `xp`, `streak` | Lesson progress, mastery scores (BKT 0–1), XP |
| `useCircuitStore` | session-only | React Flow nodes/edges, run state, simulation results |
| `useTutorStore` | session-only | Chat messages, streaming state, suggested prompts |
| `useQuizStore` | session-only | Current quiz, answers, score |
| `useBillingStore` | — | Subscription status, plan details |

### Key cross-store flows

| Trigger | What happens |
|---------|-------------|
| Quiz submitted | `useQuizStore.setScore` → `useLearningStore.updateMastery` |
| Circuit run succeeds | `useCircuitStore.setResults` → `useShellStore` opens BottomPanel |
| Quiz workspace entered | `useShellStore.setFocusMode(true)` — collapses both panels |
| Tutor message sent | reads `useLearningStore.currentLessonId` as snapshot for context |

---

## API Client

All backend calls go through `apiFetch<T>` in `lib/api.ts`:

```ts
import { apiFetch } from "@/lib/api";

const courses = await apiFetch<Course[]>("/api/v1/courses", { token: jwt });
```

- Base URL controlled by `NEXT_PUBLIC_API_URL`
- Attaches `Authorization: Bearer <token>` automatically
- Throws on network error or `json.success === false`
- Returns `json.data` — matches the backend `{ success, data }` envelope

---

## Real-time Communication

**Never poll for results.** Subscribe to Supabase Realtime channels — FastAPI publishes, the frontend subscribes.

| Channel | Event | Consumer |
|---------|-------|----------|
| `circuit:{circuitId}` | `result` | `CircuitCanvas` — writes to `useCircuitStore`, opens BottomPanel |
| `tutor:{sessionId}` | `token` | `AITutorPanel` — appends token to current message |
| `progress:{userId}` | `mastery` | Dashboard — updates `useLearningStore.masteryScores` |

Always unsubscribe on component unmount.

---

## Circuit Builder

Built on `@xyflow/react` (React Flow) with three custom node types:

| Node type | Role |
|-----------|------|
| `QubitWireNode` | Horizontal wire — one per qubit |
| `GateNode` | Quantum gate — `gateType`, `qubitIndex`, optional `params` |
| `MeasurementNode` | Measurement — shows dashed classical wire |

Gates are HTML5 drag sources from `GatePalette`. Dropping onto a wire creates a `GateNode`. The full circuit state lives in `useCircuitStore` (nodes + edges).

### Gate colors (CSS tokens)

| Gate | Token | Color |
|------|-------|-------|
| H | `--gate-H` | `#8b5cf6` |
| X | `--gate-X` | `#f85149` |
| Y | `--gate-Y` | `#f97316` |
| Z | `--gate-Z` | `#3fb950` |
| CX | `--gate-CX` | `#3b82f6` |
| M | `--gate-M` | `#00d4ff` |

### BottomPanel result tabs

| Tab | Content |
|-----|---------|
| Probabilities | Horizontal bar chart — `|00⟩ 50%`, `|11⟩ 50%`, etc. |
| State Vector | Table of amplitudes, probabilities, phases |
| QASM | Read-only OpenQASM 3 code block |

### Canvas shortcuts

| Key | Action |
|-----|--------|
| `Space` | Run simulation |
| `Delete` | Remove selected gate |
| `H / X / C / M` | Quick-place gates |
| `Ctrl+Z / Ctrl+Shift+Z` | Undo / Redo |
| `?` | Show shortcuts |

---

## AI Tutor Panel

- **Streaming:** tokens arrive via Supabase Realtime `tutor:{sessionId}` channel
- **Citations:** numbered superscript badges; hover shows source popover
- **Math:** KaTeX rendered inline in responses
- **Context:** `ContextChip` shows current lesson derived from `useLearningStore.currentLessonId`
- **Suggested prompts:** 3 contextual quick-send chips, updated per lesson

---

## Design System

All design tokens live in `src/app/globals.css` as CSS custom properties. Never hardcode hex values in components.

Key tokens: `--bg-base` · `--bg-surface` · `--border` · `--quantum` (`#00d4ff`) · `--success` · `--warning` · `--error`

Rules:
- No `box-shadow` — depth via `--border` and `--quantum` glow only
- Active nav items: `--quantum` 2px left border, never background fill
- Math: KaTeX only
- Fonts: Geist Mono/Sans for UI chrome; JetBrains Mono for code

---

## Monetization (Pro Gating)

`user.subscription_status === "pro"` controls access to:
- AI Tutor (`RightPanel`)
- Circuit execution (Run button)
- Adaptive quiz generation

All curriculum content (lessons, course structure) is free. Gate checks live in components via `useAuthStore`. Show the upgrade modal from `components/billing/` on denied access.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI backend URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Razorpay publishable key |

Copy `.env.local.example` → `.env.local`. Full reference: `../docs/infrastructure.md`.

---

## Deployment

Deployed to **Vercel** — automatic on push to `main` via GitHub Actions.

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Build command | `pnpm build` |
| Output directory | `.next` |
| Root directory | `frontend/` |

---

## Documentation

| Document | Contents |
|----------|----------|
| `design.md` | Full frontend design — shell zones, workspace layouts, component tree, store shapes, design system tokens, accessibility, animations |
| `../Architecture.md` | Platform overview and system diagram |
| `../docs/frontend-layer.md` | Shell zones, Zustand stores, design system reference |
| `../docs/data-flow.md` | All 7 platform data flows (REST, Realtime, Sandbox) |
| `../docs/security.md` | Auth flow, JWT handling, RBAC |
| `../docs/infrastructure.md` | Full env var reference and production deployment |
