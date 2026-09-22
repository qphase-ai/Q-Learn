# Dashboard Redesign — Two-Track Split + Floating AI Tutor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard placeholder with a real progress-first home page (hero strip + Circuit Learning and Coding track cards), and replace the fixed 380 px AI Tutor right panel with a floating action button (FAB) that expands into an overlay panel.

**Architecture:** Two independent tasks. Task 1 removes `RightPanel` from `AppShell`, adds a `TutorFAB` fixed at bottom-right, and renames `rightPanelOpen`/`toggleRightPanel` in `shellStore` to `tutorOpen`/`toggleTutor`. Task 2 builds the dashboard workspace from three new components (`DashboardWorkspace`, `ProgressHero`, `TrackCard`) all reading from the existing `useLearningStore`.

**Tech Stack:** Next.js 14 App Router · React 18 · TypeScript · Zustand · Tailwind CSS · Lucide React · Vitest + RTL

**Spec:** N/A — design approved in chat session 2026-09-23.

## Global Constraints

- **UI/UX quality gate:** Before writing any component JSX, invoke the `ui-ux-pro-max:ui-styling` skill (for component-level polish) or `ui-ux-pro-max:design` skill (for layout decisions). Apply its output before committing. If the skill is not available, note the skip in the commit message.
- Dark cyberpunk/glassmorphism aesthetic — use Tailwind semantic token classes only; never hardcode hex/hsl values
- Token cheat-sheet: `bg-background` (root) · `bg-surface` (panels/cards) · `bg-elevated` (dropdowns) · `border-border` / `border-white/10` (borders) · `text-foreground` · `text-muted-foreground` · `text-cyber-cyan` / `bg-cyber-cyan` (primary CTA) · `text-electric-purple` (secondary) · `text-neon-green` (success) · `shadow-glow-cyan` · `shadow-glow-purple`
- All cross-store reads are snapshots at call time — no reactive cross-store subscriptions
- `apiFetch<T>` in `lib/api.ts` for all backend calls; never use raw `fetch`
- Tests live in `frontend/test/` mirroring `frontend/src/`; framework is Vitest + RTL + jsdom
- Run `pnpm type-check` and `pnpm test` from `frontend/` to verify each task
- Motion: wrap animated elements with Framer Motion; respect `prefers-reduced-motion`
- Each workspace owns its child components — no cross-workspace imports

---

### Task 1: Replace RightPanel with TutorFAB

The fixed 380 px right column is removed. A 48 px floating cyber-cyan button at `bottom-6 right-6` replaces it — click opens a 320 px overlay panel containing `AITutorPanel`. `shellStore` renames `rightPanelOpen → tutorOpen` and `toggleRightPanel → toggleTutor`. The keyboard shortcut Ctrl+B and `tutorStore`'s on-complete hook are updated to match.

**Files:**
- Create: `frontend/src/components/shell/TutorFAB.tsx`
- Modify: `frontend/src/components/shell/AppShell.tsx`
- Modify: `frontend/src/stores/shellStore.ts`
- Modify: `frontend/src/stores/tutorStore.ts` (line 78)
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Delete: `frontend/src/components/shell/RightPanel.tsx`
- Create: `frontend/test/components/shell/TutorFAB.test.tsx`
- Modify: `frontend/test/components/shell/AppShell.test.tsx`
- Modify: `frontend/test/components/shell/Panels.test.tsx` (remove RightPanel describe block)
- Modify: `frontend/test/hooks/useKeyboardShortcuts.test.tsx`

**Interfaces:**
- Consumes: `useShellStore` → `tutorOpen: boolean`, `toggleTutor: () => void`
- Produces: `<TutorFAB />` — zero-prop default export, mounts in `AppShell`; `useShellStore` now exports `tutorOpen` + `toggleTutor` for Task 2 and any future consumer

- [ ] **Step 1: Write failing tests for TutorFAB**

Create `frontend/test/components/shell/TutorFAB.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TutorFAB from "@/components/shell/TutorFAB";
import { useShellStore } from "@/stores/shellStore";

vi.mock("@/stores/tutorStore", () => ({
  useTutorStore: (sel: (s: { messages: []; isStreaming: boolean; suggestedPrompts: string[]; sendMessage: () => void }) => unknown) =>
    sel({ messages: [], isStreaming: false, suggestedPrompts: [], sendMessage: vi.fn() }),
}));

beforeEach(() => {
  useShellStore.setState({ tutorOpen: false });
});

describe("TutorFAB", () => {
  it("renders the open FAB when tutor is closed", () => {
    render(<TutorFAB />);
    expect(screen.getByRole("button", { name: /open ai tutor/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /ai tutor/i })).not.toBeInTheDocument();
  });

  it("shows the tutor dialog when tutorOpen is true", () => {
    useShellStore.setState({ tutorOpen: true });
    render(<TutorFAB />);
    expect(screen.getByRole("dialog", { name: /ai tutor/i })).toBeInTheDocument();
  });

  it("clicking the FAB toggles tutorOpen to true", () => {
    render(<TutorFAB />);
    fireEvent.click(screen.getByRole("button", { name: /open ai tutor/i }));
    expect(useShellStore.getState().tutorOpen).toBe(true);
  });

  it("clicking the close button sets tutorOpen to false", () => {
    useShellStore.setState({ tutorOpen: true });
    render(<TutorFAB />);
    fireEvent.click(screen.getByRole("button", { name: /close ai tutor/i }));
    expect(useShellStore.getState().tutorOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && pnpm test TutorFAB
```
Expected: 4 failures — module `@/components/shell/TutorFAB` not found.

- [ ] **Step 3: Update `shellStore.ts` — rename rightPanel → tutor**

Replace the entire file `frontend/src/stores/shellStore.ts` with:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Workspace = "dashboard" | "learn" | "circuit" | "code" | "quiz" | "settings";
type BottomPanelTab = "probabilities" | "statevector" | "qasm" | "console";

interface ShellStore {
  activeWorkspace: Workspace;
  tutorOpen: boolean;
  bottomPanelOpen: boolean;
  focusMode: boolean;
  bottomPanelTab: BottomPanelTab;
  setWorkspace: (workspace: Workspace) => void;
  toggleTutor: () => void;
  toggleBottomPanel: () => void;
  setFocusMode: (focus: boolean) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
}

export const useShellStore = create<ShellStore>()(
  persist(
    (set) => ({
      activeWorkspace: "dashboard",
      tutorOpen: false,
      bottomPanelOpen: false,
      focusMode: false,
      bottomPanelTab: "probabilities",
      setWorkspace: (activeWorkspace) => set({ activeWorkspace }),
      toggleTutor: () => set((s) => ({ tutorOpen: !s.tutorOpen })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setFocusMode: (focusMode) => set({ focusMode }),
      setBottomPanelTab: (bottomPanelTab) => set({ bottomPanelTab }),
    }),
    { name: "shell", partialize: (s) => ({ bottomPanelOpen: s.bottomPanelOpen }) }
  )
);
```

- [ ] **Step 4: Update `tutorStore.ts` — use tutorOpen in onComplete**

In `frontend/src/stores/tutorStore.ts`, change line 78 from:
```ts
        useShellStore.setState({ rightPanelOpen: true });
```
to:
```ts
        useShellStore.setState({ tutorOpen: true });
```

- [ ] **Step 5: Update `useKeyboardShortcuts.ts` — Ctrl+B calls toggleTutor**

In `frontend/src/hooks/useKeyboardShortcuts.ts`, change:
```ts
      const { toggleRightPanel, toggleBottomPanel } = useShellStore.getState();
```
to:
```ts
      const { toggleTutor, toggleBottomPanel } = useShellStore.getState();
```

And change:
```ts
        toggleRightPanel();
```
to:
```ts
        toggleTutor();
```

- [ ] **Step 6: Invoke `ui-ux-pro-max:ui-styling` for TutorFAB polish**

Before writing the component, run `/ui-ux-pro-max:ui-styling` with the context: "floating chat FAB button at bottom-right, 48px rounded-full, cyber-cyan glow, expands into a 320px overlay panel with glassmorphism border. Dark cyberpunk aesthetic. Use existing tokens: bg-surface, border-white/10, shadow-glow-cyan, text-cyber-cyan, bg-cyber-cyan." Apply any styling improvements from its output to the implementation below.

- [ ] **Step 7: Create `TutorFAB.tsx`**

Create `frontend/src/components/shell/TutorFAB.tsx`:

```tsx
"use client";

import { MessageCircle, X } from "lucide-react";
import { useShellStore } from "@/stores/shellStore";
import AITutorPanel from "@/components/tutor/AITutorPanel";

export default function TutorFAB() {
  const open = useShellStore((s) => s.tutorOpen);
  const toggleTutor = useShellStore((s) => s.toggleTutor);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="AI Tutor"
          aria-modal="false"
          className="fixed bottom-20 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface shadow-glow-cyan"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">AI Tutor</span>
            <button
              onClick={toggleTutor}
              aria-label="Close AI Tutor"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="h-96 min-h-0">
            <AITutorPanel />
          </div>
        </div>
      )}
      <button
        onClick={toggleTutor}
        aria-label={open ? "Close AI Tutor" : "Open AI Tutor"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-cyber-cyan text-background shadow-glow-cyan transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X size={20} aria-hidden /> : <MessageCircle size={20} aria-hidden />}
      </button>
    </>
  );
}
```

- [ ] **Step 7: Update `AppShell.tsx` — remove RightPanel, add TutorFAB**

Replace `frontend/src/components/shell/AppShell.tsx` with:

```tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import TitleBar from "@/components/shell/TitleBar";
import ActivityBar from "@/components/shell/ActivityBar";
import BottomPanel from "@/components/shell/BottomPanel";
import StatusBar from "@/components/shell/StatusBar";
import TutorFAB from "@/components/shell/TutorFAB";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuth } from "@/hooks/useAuth";
import { useShellStore } from "@/stores/shellStore";
import { workspaceFromPathname } from "@/lib/workspaces";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setWorkspace = useShellStore((s) => s.setWorkspace);
  const { hydrate } = useAuth();

  useKeyboardShortcuts();

  useEffect(() => {
    hydrate().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = workspaceFromPathname(pathname ?? "");
    if (id) setWorkspace(id);
  }, [pathname, setWorkspace]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <main className="shell-fade flex-1 overflow-auto">{children}</main>
      </div>
      <BottomPanel />
      <StatusBar />
      <TutorFAB />
    </div>
  );
}
```

- [ ] **Step 8: Delete `RightPanel.tsx`**

```bash
cd frontend && rm src/components/shell/RightPanel.tsx
```

- [ ] **Step 9: Update `AppShell.test.tsx` — check for FAB button instead of aside**

Replace `frontend/test/components/shell/AppShell.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "@/components/shell/AppShell";
import { useShellStore } from "@/stores/shellStore";

const hydrate = vi.fn().mockResolvedValue(undefined);
vi.mock("next/navigation", () => ({
  usePathname: () => "/circuit",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ hydrate, logout: vi.fn() }) }));
vi.mock("@/stores/tutorStore", () => ({
  useTutorStore: (sel: (s: { messages: []; isStreaming: boolean; suggestedPrompts: string[]; sendMessage: () => void }) => unknown) =>
    sel({ messages: [], isStreaming: false, suggestedPrompts: [], sendMessage: vi.fn() }),
}));

beforeEach(() => {
  hydrate.mockClear();
  useShellStore.setState({ tutorOpen: false, bottomPanelOpen: true, activeWorkspace: "dashboard", bottomPanelTab: "probabilities" });
});

describe("AppShell", () => {
  it("mounts all zones and renders children", () => {
    render(
      <AppShell>
        <div>WORKSPACE CONTENT</div>
      </AppShell>
    );
    expect(screen.getByRole("banner")).toBeInTheDocument(); // TitleBar
    expect(screen.getByRole("navigation", { name: /workspaces/i })).toBeInTheDocument(); // ActivityBar
    expect(screen.getByText("WORKSPACE CONTENT")).toBeInTheDocument(); // WorkspaceArea
    expect(screen.getByRole("button", { name: /open ai tutor/i })).toBeInTheDocument(); // TutorFAB
    expect(screen.getByRole("region", { name: /simulation results/i })).toBeInTheDocument(); // BottomPanel
    expect(screen.getByRole("contentinfo")).toBeInTheDocument(); // StatusBar
  });

  it("hydrates the session on mount and syncs the workspace from the pathname", () => {
    render(<AppShell><div /></AppShell>);
    expect(hydrate).toHaveBeenCalledOnce();
    expect(useShellStore.getState().activeWorkspace).toBe("circuit");
  });
});
```

- [ ] **Step 10: Update `Panels.test.tsx` — remove RightPanel block**

Replace `frontend/test/components/shell/Panels.test.tsx` with the file below (the `describe("RightPanel", ...)` block is removed; BottomPanel tests are unchanged):

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BottomPanel from "@/components/shell/BottomPanel";
import { useShellStore } from "@/stores/shellStore";
import { useCircuitStore } from "@/stores/circuitStore";

const SEEDED_RESULTS = {
  status: "completed",
  probabilities: { "00": 0.5, "11": 0.5 },
  measurements: {},
  statevector: [
    [0.707, 0],
    [0, 0],
    [0, 0],
    [0.707, 0],
  ] as [number, number][],
  qasm: "OPENQASM 2.0; test",
  execution_time_ms: 5,
  error_message: null,
};

beforeEach(() => {
  useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "probabilities" });
  useCircuitStore.setState({ results: null });
});

describe("BottomPanel", () => {
  it("renders the four result tabs when open", () => {
    render(<BottomPanel />);
    expect(screen.getByRole("tab", { name: /probabilities/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /state vector/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /qasm/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /console/i })).toBeInTheDocument();
  });

  it("shows ProbabilityChart content on probabilities tab", () => {
    useCircuitStore.setState({ results: SEEDED_RESULTS });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "probabilities" });
    render(<BottomPanel />);
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
  });

  it("shows StateVectorTable content on statevector tab", () => {
    useCircuitStore.setState({ results: SEEDED_RESULTS });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "statevector" });
    render(<BottomPanel />);
    expect(screen.getAllByText("0.707").length).toBeGreaterThan(0);
  });

  it("shows QASM content on qasm tab", () => {
    useCircuitStore.setState({ results: SEEDED_RESULTS });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "qasm" });
    render(<BottomPanel />);
    expect(screen.getByText("OPENQASM 2.0; test")).toBeInTheDocument();
  });

  it("shows ConsoleOutput content on console tab with error_message", () => {
    useCircuitStore.setState({
      results: { ...SEEDED_RESULTS, error_message: "Simulation failed: timeout" },
    });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "console" });
    render(<BottomPanel />);
    expect(screen.getByText("Simulation failed: timeout")).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Update `useKeyboardShortcuts.test.tsx`**

Replace `frontend/test/hooks/useKeyboardShortcuts.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useShellStore } from "@/stores/shellStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Harness() {
  useKeyboardShortcuts();
  return null;
}

beforeEach(() => {
  push.mockClear();
  useShellStore.setState({ tutorOpen: false, bottomPanelOpen: false });
});

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true }));
}

describe("useKeyboardShortcuts", () => {
  it("Ctrl+B toggles the tutor FAB", () => {
    render(<Harness />);
    press("b");
    expect(useShellStore.getState().tutorOpen).toBe(true);
  });

  it("Ctrl+J toggles the bottom panel", () => {
    render(<Harness />);
    press("j");
    expect(useShellStore.getState().bottomPanelOpen).toBe(true);
  });

  it("Ctrl+3 navigates to the circuit workspace", () => {
    render(<Harness />);
    press("3");
    expect(push).toHaveBeenCalledWith("/circuit");
  });
});
```

- [ ] **Step 12: Update `tutorStore.test.ts` — rename rightPanelOpen references**

In `frontend/test/stores/tutorStore.test.ts`:

Change line 52:
```ts
  useShellStore.setState({ rightPanelOpen: false });
```
to:
```ts
  useShellStore.setState({ tutorOpen: false });
```

Change line 117 (the assertion that the panel opened after a message completes):
```ts
    expect(useShellStore.getState().rightPanelOpen).toBe(true);
```
to:
```ts
    expect(useShellStore.getState().tutorOpen).toBe(true);
```

- [ ] **Step 13: Update `circuitStore.test.ts` — remove rightPanelOpen from seed**

In `frontend/test/stores/circuitStore.test.ts`, remove the `rightPanelOpen: true,` line from the `useShellStore.setState({...})` call (around line 48). The other fields stay:

```ts
  useShellStore.setState({
    bottomPanelOpen: false,
    bottomPanelTab: "probabilities",
    focusMode: false,
    activeWorkspace: "circuit",
  });
```

- [ ] **Step 14: Run the full test suite**

```bash
cd frontend && pnpm test
```
Expected: all tests pass; no references to `rightPanelOpen` or `toggleRightPanel` remain.

- [ ] **Step 15: Type-check**

```bash
cd frontend && pnpm type-check
```
Expected: zero TypeScript errors.

- [ ] **Step 16: Commit**

```bash
git add frontend/src/components/shell/TutorFAB.tsx \
        frontend/src/components/shell/AppShell.tsx \
        frontend/src/stores/shellStore.ts \
        frontend/src/stores/tutorStore.ts \
        frontend/src/hooks/useKeyboardShortcuts.ts \
        frontend/test/components/shell/TutorFAB.test.tsx \
        frontend/test/components/shell/AppShell.test.tsx \
        frontend/test/components/shell/Panels.test.tsx \
        frontend/test/hooks/useKeyboardShortcuts.test.tsx \
        frontend/test/stores/tutorStore.test.ts \
        frontend/test/stores/circuitStore.test.ts
git rm frontend/src/components/shell/RightPanel.tsx
git commit -m "feat(shell): replace fixed RightPanel with floating TutorFAB"
```

---

### Task 2: Implement Dashboard Workspace

Build the real dashboard home page: a `ProgressHero` strip showing XP, streak, overall mastery %, and a Continue/Start-Learning CTA, followed by a two-column grid of `TrackCard`s — Circuit Learning (electric-purple) and Coding (cyber-cyan). All data comes from `useLearningStore`; no new API shapes are needed.

**Files:**
- Create: `frontend/src/components/dashboard/ProgressHero.tsx`
- Create: `frontend/src/components/dashboard/TrackCard.tsx`
- Create: `frontend/src/components/dashboard/DashboardWorkspace.tsx`
- Modify: `frontend/src/app/(shell)/dashboard/page.tsx`
- Create: `frontend/test/components/dashboard/DashboardWorkspace.test.tsx`

**Interfaces:**
- Consumes: `useLearningStore` → `xp: number`, `streak: number`, `masteryScores: Record<string,number>`, `currentLessonId: string|null`, `lessonProgress: Record<string,number>`, `loadCourses: () => Promise<void>`
- Produces: `<DashboardWorkspace />` — zero-prop default export used by `dashboard/page.tsx`

- [ ] **Step 1: Write failing dashboard tests**

Create `frontend/test/components/dashboard/DashboardWorkspace.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardWorkspace from "@/components/dashboard/DashboardWorkspace";
import { useLearningStore } from "@/stores/learningStore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: { getState: () => ({ jwt: null }) },
}));

const loadCourses = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  loadCourses.mockClear();
  useLearningStore.setState({
    xp: 420,
    streak: 7,
    masteryScores: { concept1: 0.8, concept2: 0.6 },
    currentLessonId: "lesson-abc",
    lessonProgress: { "lesson-abc": 60, "lesson-def": 100 },
    courses: [],
    activeCourse: null,
    activeLesson: null,
    loadCourses,
    loadCourse: vi.fn(),
    loadLesson: vi.fn(),
    markProgress: vi.fn(),
    setCurrentLesson: vi.fn(),
    updateProgress: vi.fn(),
    updateMastery: vi.fn(),
    addXp: vi.fn(),
  });
});

describe("DashboardWorkspace", () => {
  it("shows XP in the hero strip", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/420/)).toBeInTheDocument();
  });

  it("shows streak in the hero strip", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/7 day streak/i)).toBeInTheDocument();
  });

  it("shows average mastery as a percentage", () => {
    render(<DashboardWorkspace />);
    // (0.8 + 0.6) / 2 = 0.7 → 70%
    expect(screen.getByText(/70%\s*mastery/i)).toBeInTheDocument();
  });

  it("renders a Continue link when currentLessonId is set", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByRole("link", { name: /continue/i })).toBeInTheDocument();
  });

  it("renders Start Learning when no current lesson", () => {
    useLearningStore.setState({ currentLessonId: null });
    render(<DashboardWorkspace />);
    expect(screen.getByRole("link", { name: /start learning/i })).toBeInTheDocument();
  });

  it("renders the Circuit Learning track card", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/circuit learning/i)).toBeInTheDocument();
  });

  it("renders the Coding track card", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/^coding$/i)).toBeInTheDocument();
  });

  it("calls loadCourses on mount", () => {
    render(<DashboardWorkspace />);
    expect(loadCourses).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && pnpm test DashboardWorkspace
```
Expected: 8 failures — module `@/components/dashboard/DashboardWorkspace` not found.

- [ ] **Step 3: Invoke `ui-ux-pro-max:design` for dashboard layout review**

Before writing any dashboard component, run `/ui-ux-pro-max:design` with the context: "Progress-first dashboard for a quantum computing education app. Hero strip at top: XP counter, streak, mastery %, Continue CTA button with progress bar. Below: two equal-width cards — 'Circuit Learning' (electric-purple accent) and 'Coding' (cyber-cyan accent) each showing mastery % and lessons completed, with a Launch link. Dark cyberpunk glassmorphism aesthetic. Token reference: bg-surface for cards, border-white/10, shadow-glow-cyan / shadow-glow-purple for accent glows, text-foreground / text-muted-foreground." Apply any layout or spacing improvements from its output to the implementations below.

- [ ] **Step 4: Create `ProgressHero.tsx`**

Create `frontend/src/components/dashboard/ProgressHero.tsx`:

```tsx
import Link from "next/link";
import { Zap, Flame, Brain } from "lucide-react";

interface ProgressHeroProps {
  xp: number;
  streak: number;
  overallMastery: number;
  currentLessonId: string | null;
  currentProgress: number;
}

export default function ProgressHero({
  xp,
  streak,
  overallMastery,
  currentLessonId,
  currentProgress,
}: ProgressHeroProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-cyber-cyan" aria-hidden />
          <span className="text-lg font-semibold text-foreground">
            {xp.toLocaleString()} XP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-warning" aria-hidden />
          <span className="text-lg font-semibold text-foreground">{streak} day streak</span>
        </div>
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-neon-green" aria-hidden />
          <span className="text-lg font-semibold text-foreground">
            {overallMastery}% mastery
          </span>
        </div>
        <div className="ml-auto">
          {currentLessonId ? (
            <Link
              href="/learn"
              className="rounded-lg bg-cyber-cyan px-4 py-2 text-sm font-semibold text-background shadow-glow-cyan transition-opacity hover:opacity-90"
            >
              Continue
            </Link>
          ) : (
            <Link
              href="/learn"
              className="rounded-lg bg-cyber-cyan/15 px-4 py-2 text-sm font-semibold text-cyber-cyan transition-colors hover:bg-cyber-cyan/25"
            >
              Start Learning
            </Link>
          )}
        </div>
      </div>
      {currentLessonId && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Current lesson progress</span>
            <span>{currentProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              role="progressbar"
              aria-valuenow={currentProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${currentProgress}%` }}
              className="h-full rounded-full bg-cyber-cyan transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `TrackCard.tsx`**

Create `frontend/src/components/dashboard/TrackCard.tsx`:

```tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface TrackCardProps {
  title: string;
  icon: LucideIcon;
  href: string;
  accentClass: string;
  borderClass: string;
  completedLessons: number;
  masteryPct: number;
}

export default function TrackCard({
  title,
  icon: Icon,
  href,
  accentClass,
  borderClass,
  completedLessons,
  masteryPct,
}: TrackCardProps) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border bg-surface p-5 transition-colors ${borderClass}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={24} className={accentClass} aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground">{masteryPct}%</p>
          <p className="text-xs text-muted-foreground">mastery</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-2xl font-bold text-foreground">{completedLessons}</p>
          <p className="text-xs text-muted-foreground">lessons completed</p>
        </div>
      </div>
      <Link
        href={href}
        aria-label={`Launch ${title}`}
        className={`block rounded-lg border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-white/[0.04] ${accentClass} ${borderClass}`}
      >
        Launch
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Create `DashboardWorkspace.tsx`**

Create `frontend/src/components/dashboard/DashboardWorkspace.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { CircuitBoard, CodeXml } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import ProgressHero from "./ProgressHero";
import TrackCard from "./TrackCard";

export default function DashboardWorkspace() {
  const xp = useLearningStore((s) => s.xp);
  const streak = useLearningStore((s) => s.streak);
  const masteryScores = useLearningStore((s) => s.masteryScores);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadCourses = useLearningStore((s) => s.loadCourses);

  useEffect(() => {
    loadCourses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scores = Object.values(masteryScores);
  const overallMastery = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
    : 0;

  const completedLessons = Object.values(lessonProgress).filter((p) => p >= 100).length;
  const currentProgress = currentLessonId ? (lessonProgress[currentLessonId] ?? 0) : 0;

  return (
    <div className="shell-fade flex h-full flex-col gap-6 overflow-auto p-6">
      <ProgressHero
        xp={xp}
        streak={streak}
        overallMastery={overallMastery}
        currentLessonId={currentLessonId}
        currentProgress={currentProgress}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TrackCard
          title="Circuit Learning"
          icon={CircuitBoard}
          href="/circuit"
          accentClass="text-electric-purple"
          borderClass="border-electric-purple/20 hover:border-electric-purple/40"
          completedLessons={completedLessons}
          masteryPct={overallMastery}
        />
        <TrackCard
          title="Coding"
          icon={CodeXml}
          href="/code"
          accentClass="text-cyber-cyan"
          borderClass="border-cyber-cyan/20 hover:border-cyber-cyan/40"
          completedLessons={completedLessons}
          masteryPct={overallMastery}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Update `dashboard/page.tsx`**

Replace `frontend/src/app/(shell)/dashboard/page.tsx` with:

```tsx
import DashboardWorkspace from "@/components/dashboard/DashboardWorkspace";

export default function DashboardPage() {
  return <DashboardWorkspace />;
}
```

- [ ] **Step 8: Run the dashboard tests**

```bash
cd frontend && pnpm test DashboardWorkspace
```
Expected: 8 tests pass.

- [ ] **Step 9: Run the full test suite**

```bash
cd frontend && pnpm test
```
Expected: all tests pass.

- [ ] **Step 10: Type-check**

```bash
cd frontend && pnpm type-check
```
Expected: zero TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/dashboard/ProgressHero.tsx \
        frontend/src/components/dashboard/TrackCard.tsx \
        frontend/src/components/dashboard/DashboardWorkspace.tsx \
        frontend/src/app/(shell)/dashboard/page.tsx \
        frontend/test/components/dashboard/DashboardWorkspace.test.tsx
git commit -m "feat(dashboard): implement two-track progress dashboard"
```

---

### Task 3: Quantum Spin Background for Dashboard

A subtle animated SVG background visible only inside the dashboard workspace — three concentric orbital ellipses (tilted like a Bloch sphere) rotating at different speeds with small particle dots on each orbit. Uses `currentColor` so it picks up `text-cyber-cyan` from the parent. Respects `prefers-reduced-motion`. Positioned `absolute inset-0 -z-10` (dashboard-scoped, not global).

**Files:**
- Create: `frontend/src/components/backgrounds/QuantumSpinBackground.tsx`
- Modify: `frontend/src/components/backgrounds/index.ts` (add export)
- Modify: `frontend/src/components/dashboard/DashboardWorkspace.tsx` (add `relative`, import background)

**Interfaces:**
- Consumes: nothing — zero-prop component
- Produces: `<QuantumSpinBackground />` — default export, renders inside the dashboard container

- [ ] **Step 1: Invoke `ui-ux-pro-max:ui-styling` for animation context**

Run `/ui-ux-pro-max:ui-styling` with: "Quantum spin background — three tilted concentric orbital ellipses (Bloch-sphere style) rotating at different speeds, small glowing particle dots on each orbit, cyber-cyan stroke, opacity ~0.07, `prefers-reduced-motion` off, positioned absolute inset-0 behind dashboard content. Advise on opacity, stroke width, rotation speed, and glow effect." Apply any suggestions to the implementation below.

- [ ] **Step 2: Create `QuantumSpinBackground.tsx`**

Create `frontend/src/components/backgrounds/QuantumSpinBackground.tsx`:

```tsx
import { cn } from "@/lib/utils";

/**
 * Dashboard-scoped animated Bloch-sphere orbital background.
 * Mount inside a `relative` container — uses `absolute inset-0`, not `fixed`.
 * Three elliptical orbits rotate at different speeds; a particle dot rides each.
 * Animation is suppressed via @media (prefers-reduced-motion: reduce).
 */
export default function QuantumSpinBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden text-cyber-cyan",
        className,
      )}
    >
      <svg
        viewBox="0 0 800 600"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"
      >
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .qs-orbit { animation: none !important; }
          }
          .qs-orbit-a {
            animation: qs-cw 14s linear infinite;
            transform-origin: 400px 300px;
          }
          .qs-orbit-b {
            animation: qs-ccw 20s linear infinite;
            transform-origin: 400px 300px;
          }
          .qs-orbit-c {
            animation: qs-cw 28s linear infinite;
            transform-origin: 400px 300px;
          }
          @keyframes qs-cw  { to { transform: rotate(360deg);  } }
          @keyframes qs-ccw { to { transform: rotate(-360deg); } }
        `}</style>

        {/* Nucleus */}
        <circle cx="400" cy="300" r="7" fill="currentColor" opacity="0.9" />
        <circle cx="400" cy="300" r="16" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />

        {/* Inner orbit — tilted 0° */}
        <g className="qs-orbit qs-orbit-a">
          <ellipse cx="400" cy="300" rx="130" ry="52" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="530" cy="300" r="4" fill="currentColor" />
        </g>

        {/* Mid orbit — tilted 60° */}
        <g className="qs-orbit qs-orbit-b" transform="rotate(60, 400, 300)">
          <ellipse cx="400" cy="300" rx="230" ry="88" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="630" cy="300" r="5" fill="currentColor" />
        </g>

        {/* Outer orbit — tilted 120° */}
        <g className="qs-orbit qs-orbit-c" transform="rotate(120, 400, 300)">
          <ellipse cx="400" cy="300" rx="330" ry="124" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="730" cy="300" r="3.5" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Export from `backgrounds/index.ts`**

Add one line to `frontend/src/components/backgrounds/index.ts`:

```ts
export { default as QuantumSpinBackground } from "./QuantumSpinBackground";
```

- [ ] **Step 4: Mount background in `DashboardWorkspace.tsx`**

In `frontend/src/components/dashboard/DashboardWorkspace.tsx`, make two changes:

**Add import** at the top (after the existing imports):
```tsx
import QuantumSpinBackground from "@/components/backgrounds/QuantumSpinBackground";
```

**Add `relative` to the outer div and render the background as the first child:**

Change:
```tsx
  return (
    <div className="shell-fade flex h-full flex-col gap-6 overflow-auto p-6">
```
to:
```tsx
  return (
    <div className="shell-fade relative flex h-full flex-col gap-6 overflow-auto p-6">
      <QuantumSpinBackground />
```

- [ ] **Step 5: Run type-check**

```bash
cd frontend && pnpm type-check
```
Expected: zero TypeScript errors.

- [ ] **Step 6: Run full test suite**

```bash
cd frontend && pnpm test
```
Expected: all tests pass. The background renders `aria-hidden` so existing dashboard tests are unaffected.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/backgrounds/QuantumSpinBackground.tsx \
        frontend/src/components/backgrounds/index.ts \
        frontend/src/components/dashboard/DashboardWorkspace.tsx
git commit -m "feat(dashboard): add quantum spin orbital background animation"
```
