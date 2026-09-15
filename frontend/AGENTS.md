# AGENTS.md — Q-Learn Frontend

Guidance for AI coding agents working in `frontend/`.

---

## Orientation

Next.js 14 App Router frontend. The UI is a **persistent VS Code-style IDE shell** (`AppShell`) that mounts once — navigation swaps only the `WorkspaceArea`. State lives in Zustand stores. Real-time events arrive via Supabase Realtime channels — never by polling the API. Pro features are gated by `user.subscription_status`.

Read `design.md` in this directory before any significant change.

---

## Directory map

```
frontend/src/
├── app/                    Next.js App Router — page files only, no component logic
│   ├── layout.tsx          Root layout — mounts AppShell
│   ├── auth/               Login / Register pages
│   └── dashboard/ learn/ circuit/ quiz/ pricing/ settings/
├── components/
│   ├── circuit/            React Flow circuit builder — GateNode, QubitWireNode, GatePalette
│   ├── tutor/              AITutorPanel — streaming, citations, KaTeX
│   ├── visualization/      ProbabilityChart, StateVectorTable, QASMViewer
│   ├── billing/            Pricing page, upgrade modal
│   └── ui/                 Primitive atoms (Button, Badge, etc.)
├── stores/                 Zustand stores — one per domain, no cross-store imports
├── hooks/                  Custom hooks wrapping store + API logic
├── lib/
│   ├── api.ts              apiFetch<T> — all FastAPI calls
│   └── supabase.ts         Supabase client + Realtime subscriptions
└── types/index.ts          Shared TypeScript types
```

---

## Non-negotiable rules

| Rule | Consequence of breaking |
|------|------------------------|
| Never poll the API for circuit results or tutor tokens | Creates race conditions and duplicates the Realtime subscription |
| Never add direct FastAPI WebSocket connections | The backend has no ws:// endpoints — use Supabase Realtime |
| No cross-store reactive subscriptions | Causes cascading re-renders; cross-domain reads must be point-in-time snapshots |
| No cross-workspace component imports | Workspaces are self-contained — data flows via stores only |
| Never hardcode color hex values in components | All tokens defined in `globals.css` — use CSS custom properties |
| No `box-shadow` | Depth via `--border` and `--quantum` glow only |
| Active nav states use 2px left border | Never background fills for active items |
| Always unsubscribe Supabase channels on unmount | Channel leaks accumulate across route changes |
| Never gate curriculum content | Lessons and course structure are free; only AI Tutor + execution + adaptive quizzes are Pro |

---

## Shell architecture recap

```
AppShell (mounts once)
├── TitleBar        36px top
├── ActivityBar     48px left — mode switcher
├── WorkspaceArea   fills remaining — swapped on mode change (lazy)
├── RightPanel      380px right — AITutorPanel, Ctrl+B
├── BottomPanel     250px bottom — simulation/console, Ctrl+J
└── StatusBar       24px bottom
```

Mode switch = `useShellStore.setWorkspace(workspace)`. Quiz mode also calls `setFocusMode(true)`.

---

## Zustand store rules

Seven stores. Each owns one domain.

| Store | Session-only? | Persisted keys |
|-------|--------------|---------------|
| `useShellStore` | No | `rightPanelOpen`, `bottomPanelOpen` |
| `useAuthStore` | No | `jwt` |
| `useLearningStore` | No | `lessonProgress`, `xp`, `streak` |
| `useCircuitStore` | Yes | — |
| `useTutorStore` | Yes | — |
| `useQuizStore` | Yes | — |
| `useBillingStore` | — | — |

**Adding state to a store:**
- Add the field to the interface
- Initialize it in the `create()` call
- Add an action if mutation is needed
- If it should persist, add to `partialize`

**Cross-store interaction pattern** (snapshot, not subscription):
```ts
// In useCircuitStore.runSimulation:
const lessonId = useLearningStore.getState().currentLessonId  // snapshot ✓

// Never:
const { currentLessonId } = useLearningStore()  // inside another store ✗
```

---

## API client

All backend calls go through `apiFetch<T>` in `lib/api.ts`:

```ts
import { apiFetch } from "@/lib/api";

const result = await apiFetch<SimulationResult>("/api/v1/simulations/execute", {
  method: "POST",
  body: JSON.stringify(circuitSpec),
  token: useAuthStore.getState().jwt ?? undefined,
});
```

- `token` adds `Authorization: Bearer <token>` automatically
- Throws `Error` with backend message on `!res.ok` or `json.success === false`
- Returns `json.data` — never unwrap manually

---

## Realtime subscriptions

Subscribe in the component that consumes the event. Unsubscribe in the cleanup.

```ts
useEffect(() => {
  const channel = supabase
    .channel(`circuit:${circuitId}`)
    .on("broadcast", { event: "result" }, ({ payload }) => {
      circuitStore.setResults(payload);
      shellStore.toggleBottomPanel();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [circuitId]);
```

| Channel | Event | Who subscribes |
|---------|-------|---------------|
| `circuit:{circuitId}` | `result` | `CircuitCanvas` |
| `tutor:{sessionId}` | `token` | `AITutorPanel` |
| `progress:{userId}` | `mastery` | Dashboard |

---

## Circuit builder

React Flow with three custom node types: `GateNode`, `QubitWireNode`, `MeasurementNode`.

- All circuit state (`nodes`, `edges`) lives in `useCircuitStore`
- `onNodesChange` / `onEdgesChange` from React Flow must call `setNodes` / `setEdges`
- Circuit execution: POST to `/api/v1/circuits/{id}/execute`, then await Supabase Realtime `result`
- Gate colors must use CSS tokens (`--gate-H`, `--gate-X`, etc.) — never hardcoded hex

**Adding a new gate:**
1. Add the gate token to `globals.css` if it needs a new color
2. Add a drag source in `GatePalette`
3. Add the `GateNode` rendering branch in the node component (check `gateType`)
4. Add the gate to `CircuitSpec` → `GateSpec.type` in `types/index.ts`
5. Coordinate with backend: add to `sandbox_adapter.py` `gate_map`

---

## Adding a new workspace

1. Read `design.md` for the layout spec
2. Add the workspace name to `Workspace` type in `shellStore.ts`
3. Add an `ActivityIcon` entry in `ActivityBar`
4. Create the workspace component under `components/workspaces/<name>/` (or a named subdir)
5. Add a lazy-loaded branch in `WorkspaceArea`
6. If it needs Focus Mode, call `useShellStore.setFocusMode(true)` on enter

---

## Adding a new page route

Routes are in `app/`. Page files should contain only a React component that imports from `components/`. No business logic, no direct API calls, no store writes in page files — delegate to the workspace component.

---

## Design system

All tokens in `src/app/globals.css`. Key rules:

- No `box-shadow` — depth via `--border` and `--quantum` glow (`0 0 8px #00d4ff40`)
- Active states: `--quantum` 2px left border, never background fill
- Math: KaTeX only (not MathJax)
- Fonts: Geist Mono (UI), Geist Sans (prose), JetBrains Mono (code)
- The only solid-color surface is the StatusBar (`--quantum` background)

---

## Pro gating

Check `useAuthStore.getState().user?.subscription_status === "pro"` before rendering Pro features. On denial, trigger the upgrade modal from `components/billing/` — do not redirect or throw.

Gated features: AI Tutor (RightPanel), circuit execution (Run button), adaptive quiz generation.  
Never gate: lessons, course content, curriculum, circuit building (save without execute).

---

## Type conventions

All shared types in `types/index.ts`. Do not define types inline in components or stores — add to `types/index.ts` and import.

Key types already defined: `User`, `Course`, `Module`, `Lesson`, `GateSpec`, `CircuitSpec`, `SimulationResult`, `Plan`.

---

## What not to do

- Do not fetch data directly inside a Zustand store action via `useEffect` — fetch in a hook or component, then call the store setter
- Do not import one workspace's components into another workspace
- Do not add a Monaco Editor import to the top-level bundle — dynamic import only
- Do not add a Three.js import in Phase 1 — Bloch sphere is Phase 2, dynamic import only
- Do not add a spinner for AI tutor responses — token streaming is the UX; a spinner before the first token is acceptable
- Do not use `localStorage` directly — all persistence goes through Zustand `persist` middleware
- Do not add `console.log` statements to committed code
