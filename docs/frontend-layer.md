# Frontend Layer

> Full design detail: [`frontend/design.md`](../frontend/design.md)

**Stack:** Next.js 14+ (App Router) · React 18+ · TypeScript · Tailwind CSS · Zustand · `@xyflow/react` · Monaco Editor · KaTeX · shadcn/ui · Geist + JetBrains Mono fonts

---

## Shell Architecture

The UI is a **persistent VS Code-style IDE shell** that mounts once. Navigation swaps only the `WorkspaceArea` — the chrome never re-renders on mode switch.

### 6 Zones

| Zone | Size | Purpose |
|------|------|---------|
| TitleBar | 36px top | Breadcrumb nav, XP progress bar, user menu |
| ActivityBar | 48px left | Icon-only mode switcher (6 modes) |
| WorkspaceArea | fills remaining | Active workspace — lazy-loaded per mode |
| RightPanel | 380px right | AI Tutor panel — collapsible (Ctrl+B) |
| BottomPanel | 250px bottom | Simulation results / console — collapsible (Ctrl+J) |
| StatusBar | 24px bottom | Current level, mastery score, backend status |

**6 Modes (ActivityBar):** Dashboard · Learn · Circuit Builder · Code Editor · Quiz / Assessment · Settings

Quiz mode activates **focus mode**: ActivityBar dims to 30%, both panels collapse. Restored on exit.

---

## Workspace Layouts

| Workspace | Layout |
|-----------|--------|
| **Dashboard** | Two-column — Learning Path Timeline (left 40%) + Skill Mastery chart, Next Activity, Recent Feed (right 60%) |
| **Learn** | Lesson Outline (left 220px) + Lesson Content (Markdown + KaTeX + inline circuit SVGs); BottomPanel auto-opens for referenced circuits |
| **Circuit Builder** | Gate Palette (left 180px) + React Flow Canvas + Circuit Toolbar; BottomPanel auto-expands on Run with Probabilities / State Vector / QASM tabs |
| **Code Editor** | File Tree (left 200px) + Monaco Editor (python3.13, Qiskit type stubs); BottomPanel = Console |
| **Quiz** | Full-width distraction-free; progress bar + question + answer options + hint button |

---

## State Management (Zustand)

Seven domain stores — no cross-store reactive subscriptions; cross-domain reads are point-in-time snapshots.

| Store | Key state |
|-------|-----------|
| `useShellStore` | `activeWorkspace`, `rightPanelOpen`, `bottomPanelOpen`, `focusMode`, `bottomPanelTab` |
| `useAuthStore` | `user`, `jwt`, `isLoading` |
| `useLearningStore` | `currentLessonId`, `lessonProgress`, `masteryScores` (BKT, 0–1), `xp`, `streak` |
| `useCircuitStore` | `nodes`, `edges`, `runState`, `results: SimulationResult` |
| `useTutorStore` | `messages`, `isStreaming`, `suggestedPrompts` |
| `useQuizStore` | `quiz`, `currentIndex`, `answers`, `score` |
| `useBillingStore` | `subscriptionStatus`, `currentPlan`, `isUpgradeModalOpen`, `triggerFeature` |

**localStorage persistence:** `jwt` only (auth) · `lessonProgress`/`xp`/`streak` (learning) · `rightPanelOpen`/`bottomPanelOpen` (shell). Circuit, quiz, and tutor state are session-only.

---

## Design System Highlights

- **Color tokens:** `--bg-base #0d0d0d` · `--quantum #00d4ff` (primary accent) · `--success #3fb950` · `--error #f85149`
- **Gate colors:** H=purple · X=red · Y=orange · Z=green · CX=blue · M=cyan — consistent across palette, canvas, and QASM viewer
- **No `box-shadow`** — depth expressed via `--border` and `--quantum` glow (`0 0 8px #00d4ff40`) only
- **Typography:** Geist Mono (UI chrome) · Geist Sans (lesson prose) · JetBrains Mono (code/QASM) · KaTeX (math)

---

## Communication

- **REST** — HTTPS to FastAPI for all data operations
- **Real-time** — Supabase Realtime channels via Supabase JS SDK; subscribes to named channels (`circuit:{id}`, `tutor:{session_id}`) for circuit results, AI tutor token stream, and progress updates — no direct FastAPI `ws://` endpoints
