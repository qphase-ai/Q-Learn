# Q-Learn — Frontend Design

## Overview

This document is the living frontend reference for Q-Learn. It covers the IDE shell architecture, design system, workspace layouts, component structure, and state management.

**Framework:** Next.js 14+ (App Router) · React 18+ · TypeScript · Tailwind CSS  
**Deployment:** Vercel hosts the Next.js frontend and provides Sandbox for isolated student code execution. API calls go to FastAPI on Railway. Auth is managed by Supabase.

> **Architecture is portable.** The backend runs on Railway, Fly.io, any VPS, or cloud provider without redesigning the frontend.

---

## Table of Contents

- [Shell Architecture](#shell-architecture)
- [Design System](#design-system)
- [Workspace Layouts](#workspace-layouts)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Circuit Builder Detail](#circuit-builder-detail)
- [Visualization Design](#visualization-design)
- [AI Tutor Panel Detail](#ai-tutor-panel-detail)
- [Accessibility](#accessibility)
- [Animations & Transitions](#animations--transitions)
- [File Structure](#file-structure)
- [References](#references)

---

## Shell Architecture

The UI is a **persistent VS Code IDE shell** that mounts once. Navigation swaps only the center `WorkspaceArea` — the chrome never re-renders on mode switch.

### 6 Zones

| Zone | Size | Description |
|---|---|---|
| TitleBar | 36px, top | Breadcrumb nav + XP progress bar + user menu |
| ActivityBar | 48px, left | Icon-only mode switcher — 6 modes |
| WorkspaceArea | fills remaining | Active workspace content, lazy-loaded |
| RightPanel | 380px, right | AI Tutor — collapsible, Ctrl+B |
| BottomPanel | 250px, bottom | Simulation results / console — collapsible, Ctrl+J |
| StatusBar | 24px, bottom | Current level, mastery score, backend status |

### 6 Modes (ActivityBar icons)

1. Dashboard
2. Learn
3. Circuit Builder
4. Code Editor
5. Quiz / Assessment
6. Settings

### Focus Mode

Quiz workspace activates focus mode: ActivityBar icon opacity drops to 30%, RightPanel and BottomPanel collapse. Exiting quiz restores previous panel state.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+B | Toggle RightPanel (AI Tutor) |
| Ctrl+J | Toggle BottomPanel (Simulation / Console) |
| Ctrl+1…5 | Switch workspace by index |

---

## Design System

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#0d0d0d` | Root background |
| `--bg-surface` | `#141414` | Panels, cards |
| `--bg-elevated` | `#1a1a1a` | Dropdowns, tooltips |
| `--bg-hover` | `#242424` | Hover states |
| `--border` | `#2a2a2a` | All borders |
| `--quantum` | `#00d4ff` | Primary accent — quantum cyan |
| `--quantum-dim` | `#00d4ff26` | Glow backgrounds, selections |
| `--success` | `#3fb950` | Correct answers, passed |
| `--warning` | `#d29922` | Partial mastery, hints |
| `--error` | `#f85149` | Wrong answers, errors |
| `--text-primary` | `#d4d4d4` | Body text |
| `--text-secondary` | `#8b8b8b` | Labels, captions |
| `--text-muted` | `#555555` | Placeholders, disabled |

**No `box-shadow`.** Depth is expressed through `--border` and `--quantum` glow (`0 0 8px #00d4ff40`) only.

StatusBar background uses `--quantum` with dark text — the one solid-color surface in the UI.

### Gate Colors

| Token | Value | Gate |
|---|---|---|
| `--gate-H` | `#8b5cf6` | Hadamard |
| `--gate-X` | `#f85149` | Pauli-X |
| `--gate-Y` | `#f97316` | Pauli-Y |
| `--gate-Z` | `#3fb950` | Pauli-Z |
| `--gate-CX` | `#3b82f6` | CNOT |
| `--gate-M` | `#00d4ff` | Measurement |
| `--wire` | `#8b8b8b` | Circuit wires |

### Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| UI chrome (labels, nav, ActivityBar) | Geist Mono | 13px | 400 |
| Lesson body text | Geist Sans | 15px | 400 |
| Code (Monaco editor, QASM viewer) | JetBrains Mono | 13px | 400 |
| Heading H1 | Geist Sans | 24px | 600 |
| Heading H2 | Geist Sans | 18px | 600 |

Base: 14px root. Monospace everywhere except lesson prose. Math notation rendered via KaTeX: inline `|ψ⟩ = α|0⟩ + β|1⟩`, block `$$\hat{H}|\psi\rangle$$`.

### Spacing & Shape

- Base unit: 4px
- Border radius: 4px for components, 2px for inputs
- Active states: `--quantum` 2px left border — never background fills for nav items

---

## Workspace Layouts

### Dashboard

Two-column layout. BottomPanel stays closed.

- **Left 40%:** Welcome greeting + CTA, Learning Path Timeline (vertical scrollable level list)
- **Right 60%:** Skill Mastery chart (horizontal bars per concept), Next Activity Card (deep-links into workspace), Recent Activity Feed

### Learn

- **Left 220px:** Lesson Outline Panel — scrollable section tree. Active section: `--quantum` 2px left border.
- **Center:** Lesson Content — rendered markdown, KaTeX math, inline circuit SVG previews. "Open in Circuit Builder" CTA teleports the circuit to the Circuit workspace.
- **BottomPanel:** Hidden by default. Auto-opens (read-only circuit preview) when lesson references a circuit.

### Circuit Builder

Three internal zones:

- **Left 180px:** Gate Palette — collapsible groups: Single-qubit (H X Y Z S T I), Two-qubit (CX CZ SWAP), Parametric (RX RY RZ), Measure (M). Gates are dragsources.
- **Center:** Circuit Toolbar (name, qubit count, ▶ Run, JSON export, Clear) + React Flow Canvas. Parametric gates show inline angle input on select.
- **BottomPanel:** Auto-expands on Run. Tabs: **Probabilities** · **State Vector** · **QASM**.

### Code Editor

- **Left 200px:** File Tree — challenge files + read-only starter.
- **Center:** Monaco Editor — python3.13, Qiskit type stubs, ▶ Run button.
- **BottomPanel:** Console — stdout/stderr from Vercel Sandbox execution.

### Quiz (Focus Mode)

Full-width, distraction-free:

- Progress bar: "Question 3 of 5 · Concept · ████░░"
- Question: rendered markdown + inline math
- Answer options: radio group, single-select
- Hint button: costs mastery points, one hint per question
- Navigation: Previous / Submit

ActivityBar at 30% opacity. Both panels hidden. On submit: RightPanel expands with AI explanation.

---

## Component Architecture

### Shell Tree

```
AppShell
├── TitleBar
│   ├── BreadcrumbNav
│   ├── XPProgressBar
│   └── UserMenu
├── ActivityBar
│   ├── ActivityIcon ×6
│   └── Tooltip
├── WorkspaceArea  (lazy-loads active workspace)
│   ├── DashboardWorkspace
│   ├── LearnWorkspace
│   ├── CircuitBuilderWorkspace
│   ├── CodeEditorWorkspace
│   └── QuizWorkspace
├── RightPanel
│   └── AITutorPanel
├── BottomPanel
│   └── SimulationResultsPanel
└── StatusBar
```

### Workspace Subtrees

**DashboardWorkspace**
```
DashboardWorkspace
├── LearningPathTimeline
├── SkillMasteryChart
├── NextActivityCard
└── RecentActivityFeed
```

**LearnWorkspace**
```
LearnWorkspace
├── LessonOutlinePanel
│   └── OutlineItem ×n
└── LessonContentArea
    ├── MarkdownRenderer
    ├── KaTeXRenderer
    ├── InlineCircuitPreview
    └── LessonNavigation
```

**CircuitBuilderWorkspace**
```
CircuitBuilderWorkspace
├── GatePalette
│   ├── GatePaletteGroup
│   └── DraggableGate
└── CircuitCanvas
    ├── CircuitToolbar
    └── ReactFlowCanvas
        ├── QubitWireNode
        ├── GateNode
        └── MeasurementNode
```

**CodeEditorWorkspace**
```
CodeEditorWorkspace
├── FileTreePanel
└── MonacoEditor
```

**QuizWorkspace**
```
QuizWorkspace
├── QuizProgressBar
├── QuestionDisplay
├── AnswerOptions
├── HintButton
└── QuizNavigation
```

**Shared Panels**
```
AITutorPanel
├── ConversationHistory
│   └── MessageBubble (user | assistant | citation variants)
├── ContextChip
├── SuggestedPrompts
└── MessageInput

SimulationResultsPanel
├── PanelTabBar  (Probabilities | State Vector | QASM | Console)
├── ProbabilityChart
├── StateVectorTable
├── QASMViewer
└── ConsoleOutput
```

### Key Component Contracts

| Component | Key props |
|---|---|
| `GateNode` | `gateType`, `qubitIndex`, `params?: { theta, phi, lambda }` |
| `MessageBubble` | `role`, `content`, `citations?: Citation[]` |
| `InlineCircuitPreview` | `circuitId \| circuitQASM` — fetches snapshot if only id given |

### Colocation Rule

Each workspace owns its child components. No cross-workspace imports. Cross-workspace data flows only through Zustand stores.

---

## State Management

Six Zustand stores. Each owns one domain. No store imports from another. Cross-domain reads are snapshots at call time, not reactive subscriptions.

### Store Shapes

**useShellStore**
```ts
{
  activeWorkspace: 'dashboard' | 'learn' | 'circuit' | 'code' | 'quiz' | 'settings'
  rightPanelOpen: boolean
  bottomPanelOpen: boolean
  focusMode: boolean
  bottomPanelTab: 'probabilities' | 'statevector' | 'qasm' | 'console'

  setWorkspace(w): void
  toggleRightPanel(): void
  toggleBottomPanel(): void
  setBottomPanelTab(tab): void
  setFocusMode(focus: boolean): void
}
```

**useAuthStore**
```ts
{
  user: { id, email, displayName, role } | null
  jwt: string | null
  isLoading: boolean

  login(email, password): Promise<void>
  logout(): void
  refreshToken(): Promise<void>
}
```

**useLearningStore**
```ts
{
  currentLessonId: string | null
  lessonProgress: Record<string, number>   // lesson completion percentage 0–100
  masteryScores: Record<string, number>    // 0–1, BKT output
  xp: number
  streak: number

  setCurrentLesson(id: string | null): void
  updateProgress(lessonId: string, pct: number): void
  updateMastery(conceptId: string, score: number): void
  addXp(amount: number): void
}
```

**useCircuitStore**
```ts
{
  nodes: Node[]
  edges: Edge[]
  circuitName: string
  qubitCount: number
  runState: 'idle' | 'running' | 'success' | 'error'
  results: SimulationResult | null

  setNodes(nodes): void
  setEdges(edges): void
  addQubit(): void
  removeQubit(index): void
  renameCircuit(name): void
  runSimulation(): Promise<void>
  clearCircuit(): void
  loadFromQASM(qasm: string): void
}
```

**useTutorStore**
```ts
{
  messages: Message[]        // { id, role, content, citations?, timestamp }
  isStreaming: boolean
  suggestedPrompts: string[]

  addMessage(message: Message): void
  setStreaming(streaming: boolean): void
  clearMessages(): void
}
```

**useQuizStore**
```ts
{
  quiz: QuizQuestion[]    // { id, question_text, question_type, options }
  currentIndex: number
  answers: Record<string, string>
  score: number

  setQuiz(quiz: QuizQuestion[]): void
  setAnswer(questionId: string, answer: string): void
  nextQuestion(): void
  setScore(score: number): void
  reset(): void
}
```

### Data Flow

| Trigger | Store updated | Side effect |
|---|---|---|
| User switches workspace | `useShellStore.setWorkspace` | Quiz → also calls `setFocusMode(true)` |
| Lesson section read | `useLearningStore.markSectionRead` | Persists via API; no other store touched |
| Circuit simulation run | `useCircuitStore.runSimulation` | On success: opens BottomPanel, sets tab to probabilities |
| Quiz submitted | `useQuizStore.setScore` | On complete: calls `useLearningStore.updateMastery` |
| AI tutor message sent | `useTutorStore.addMessage` | Reads `useLearningStore.currentLessonId` as snapshot at send time |

### Persistence (localStorage via Zustand `persist`)

| Store | Persisted keys |
|---|---|
| `useAuthStore` | `jwt` only |
| `useLearningStore` | `lessonProgress`, `xp`, `streak` |
| `useShellStore` | `rightPanelOpen`, `bottomPanelOpen` |

Circuit, quiz, and tutor state are session-only — cleared on reload.

---

## Circuit Builder Detail

### Drag-and-Drop

Gates are HTML5 dragsources from the palette. Dropping onto a qubit wire creates a `GateNode` at that position. Dropping between existing gates inserts at that index.

### Gate Node States

- **Default** — gate color background, symbol centered
- **Selected** — `--quantum` border + properties panel opens
- **Running** — animated pulse during simulation
- **Error** — `--error` border + warning icon for invalid placements

### Wire Rendering

- Horizontal lines: quantum theme `--wire` color
- CX connections: curved bezier from control qubit to target
- Measurement gates: dashed classical bit output wire
- Simulation run: signal pulse animation along wires

### Canvas Controls

| Control | Action |
|---|---|
| Scroll wheel | Zoom |
| Drag empty space | Pan |
| Ctrl+Z / Ctrl+Shift+Z | Undo / Redo |
| Space | Run simulation |
| Delete | Remove selected gate |
| H / X / C / M | Place H / X / CX / Measurement gate |
| ? | Show shortcuts help |

---

## Visualization Design

### Probability Chart

Horizontal bar chart in the BottomPanel Probabilities tab:

```
|00⟩ ████████░░ 50%
|01⟩ ░░░░░░░░░░  0%
|10⟩ ░░░░░░░░░░  0%
|11⟩ ████████░░ 50%
```

- Bars animate from 0 on simulation complete
- Hover shows exact amplitude and phase
- Color: `--quantum` gradient

### State Vector Table

BottomPanel State Vector tab:

| State | Amplitude | Probability | Phase |
|---|---|---|---|
| \|00⟩ | 0.707 | 50% | 0° |
| \|01⟩ | 0 | 0% | — |
| \|10⟩ | 0 | 0% | — |
| \|11⟩ | 0.707 | 50% | 0° |

### QASM Viewer

Read-only code block in the QASM tab, JetBrains Mono, copy button. Shows the OpenQASM 3 equivalent of the current circuit.

### State Transition Diagram (Learn workspace, inline)

```
Initial: |00⟩
    │  H on q0
    ▼
|+0⟩
    │  CX (q0→q1)
    ▼
(|00⟩ + |11⟩)/√2
    │  Measure
    ▼
|00⟩ or |11⟩  (50% each)
```

### Bloch Sphere (Phase 2+)

Three.js 3D interactive: rotatable, state vector arrow, gate operation animations. Dynamic import only — not bundled in Phase 1.

---

## AI Tutor Panel Detail

### Message Types

**Assistant message**
```
┌─────────────────────────────────────┐
│ Q-Learn Tutor                       │
│                                     │
│ Superposition means the qubit can   │
│ exist in |ψ⟩ = α|0⟩ + β|1⟩         │
│ where |α|² + |β|² = 1               │
│                                     │
│ [1] Qiskit Docs  [2] Level 4, L3    │
└─────────────────────────────────────┘
```

**Student message**
```
┌─────────────────────────────────────┐
│ You                                 │
│ Can a qubit be both 0 and 1?        │
└─────────────────────────────────────┘
```

### Features

- Token-by-token streaming response via Supabase Realtime
- Citation badges: numbered superscripts, hover = source popover
- KaTeX math rendered inline in responses
- Inline circuit SVG diagrams in responses
- Suggested prompts: 3 contextual quick-send chips, update per lesson
- ContextChip: "Discussing: Superposition lesson" — derived from `useLearningStore.currentLessonId`
- 👍/👎 feedback on each response

---

## Accessibility

### WCAG 2.1 AA

- Color contrast: minimum 4.5:1 for text, 3:1 for UI components
- All interactive elements reachable via Tab
- ARIA labels, semantic HTML, live regions for dynamic content
- Visible focus rings on all interactive elements
- Respect `prefers-reduced-motion`

### Feature-Specific

| Feature | Implementation |
|---|---|
| Circuit builder | Keyboard shortcuts for all gates; screen reader announces circuit structure |
| Math rendering | Alt text for formulas, ARIA-live for equation updates |
| Charts | Data table alternative, `aria-label` with summary |
| Tutor panel | Message timestamps, sender identification, typing indicator |
| Navigation | Skip links, breadcrumb, landmark roles |

---

## Animations & Transitions

### Panel Transitions

| Transition | Duration | Easing |
|---|---|---|
| RightPanel open/close | 250ms | ease-in-out |
| BottomPanel open/close | 200ms | ease-in-out |
| Workspace swap | 150ms | ease-out (fade) |
| Modal overlay | 250ms | ease |

### Micro-interactions

| Element | Animation | Duration |
|---|---|---|
| Gate placement | Bounce + glow | 300ms |
| Circuit run | Signal pulse along wire | 500ms |
| Probability bars | Grow from 0 to value | 600ms ease-out |
| Mastery update | Progress bar animate | 400ms |
| Chat message | Slide in from bottom | 200ms |
| Typing indicator | Three dots pulsing | 1000ms infinite |
| ActivityBar icon active | Cyan left border slide in | 150ms |

### Celebration Animations

- Level-up: confetti burst (canvas-based)
- Mastery achieved: badge glow + pulse
- Perfect quiz: star rating animation
- Circuit success: signal flow across entire circuit

### Loading States

- Skeleton screens for content loading
- Spinning quantum symbol (CSS) for simulation
- Token-by-token streaming for AI responses (no spinner)

---

## File Structure

```
apps/web/src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout — mounts AppShell
│   ├── page.tsx                  # Auth redirect
│   └── auth/
│       ├── login/page.tsx
│       ├── register/page.tsx
│       └── forgot-password/page.tsx
│
├── components/
│   ├── shell/                    # AppShell, TitleBar, ActivityBar,
│   │                             # RightPanel, BottomPanel, StatusBar
│   │
│   ├── workspaces/
│   │   ├── dashboard/            # DashboardWorkspace + children
│   │   ├── learn/                # LearnWorkspace + children
│   │   ├── circuit-builder/      # CircuitBuilderWorkspace + children
│   │   ├── code-editor/          # CodeEditorWorkspace + children
│   │   └── quiz/                 # QuizWorkspace + children
│   │
│   └── shared/                   # AITutorPanel, SimulationResultsPanel,
│                                 # primitive UI atoms (Button, Badge, etc.)
│
├── stores/
│   ├── useShellStore.ts
│   ├── useAuthStore.ts
│   ├── useLearningStore.ts
│   ├── useCircuitStore.ts
│   ├── useTutorStore.ts
│   └── useQuizStore.ts
│
├── hooks/
│   ├── useAuth.ts
│   ├── useCircuit.ts
│   ├── useTutor.ts
│   ├── useQuiz.ts
│   └── useMastery.ts
│
├── lib/
│   ├── api.ts                    # API client (FastAPI backend)
│   ├── supabase.ts               # Supabase client + Realtime
│   ├── utils.ts
│   └── quantum-helpers.ts        # Dirac notation formatters
│
├── types/
│   ├── circuit.ts
│   ├── user.ts
│   ├── quiz.ts
│   ├── quantum.ts
│   └── api.ts
│
└── styles/
    ├── globals.css               # CSS custom properties (--bg-base, --quantum, etc.)
    └── animations.css            # Keyframes
```

---

## Technology Decisions

| Concern | Choice | Reason |
|---|---|---|
| Circuit canvas | `@xyflow/react` | Best-in-class drag-and-drop graph, node customization |
| Code editor | Monaco Editor | VS Code engine; Qiskit type stubs |
| Math rendering | KaTeX | Faster than MathJax; sufficient for Dirac notation |
| Markdown | remark + rehype | Composable; supports custom directives for circuit embeds |
| State | Zustand | Minimal boilerplate; works with React Flow's internal model |
| Fonts | Geist Mono/Sans + JetBrains Mono | Vercel-native; no external CDN dependency |
| AI Tutor streaming | Supabase Realtime | Already in stack; avoids separate WebSocket service |
| Component primitives | shadcn/ui (selective) | Accessibility baseline for inputs, dialogs, tooltips |

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React Flow Documentation](https://reactflow.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [KaTeX Math Rendering](https://katex.org/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Geist Font](https://vercel.com/font)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
- [Radix UI (Accessibility)](https://www.radix-ui.com/primitives)
- [Three.js Documentation](https://threejs.org/docs/)
