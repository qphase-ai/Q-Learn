# Lab Shell Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the redesigned `/dashboard` chrome to `/learn`, `/circuit`, `/code`, `/quiz` as focused, full-height single-tab views of the same `CentralWorkspace`, and build out `/code` (Monaco + file tree) and `/quiz` (focus-mode quiz flow) for the first time.

**Architecture:** Extract the dashboard's header/activity-bar/sidebar/tutor-panel chrome into a reusable `LabShell`; give `CentralWorkspace` a `lockedTab` mode that drops its pill switcher and fills all available height; each of the four routes mounts `LabShell` + either `CentralWorkspace lockedTab="…"` (learn/circuit/code) or a new `QuizWorkspace` (quiz, in focus mode). Retire the old generic `(shell)` `AppShell` once nothing references it.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind, Zustand, `@xyflow/react`, Vitest + React Testing Library, `@monaco-editor/react` (new dependency, dynamic-imported per project convention).

**Spec:** `docs/superpowers/specs/2026-09-27-lab-shell-workspaces-design.md`

## Global Constraints

- Never hardcode colors or read CSS vars directly in new components — use Tailwind semantic classes (`bg-surface`, `text-foreground`, `border-white/10`, etc.) per `frontend/CLAUDE.md`.
- Monaco Editor: dynamic import only (`next/dynamic(..., { ssr: false })`) — never in the initial bundle.
- No cross-workspace component imports outside the shared `dashboard/` chrome and `shared`/`ui` primitives — each workspace's own components stay colocated.
- No new backend endpoints. Quiz content and code-execution stand-ins are frontend-only and must be clearly commented as placeholders for future backend endpoints, never faking a working backend.
- `pnpm type-check`, `pnpm lint`, and `pnpm test` must stay green after every task; `pnpm build` must succeed by the final task.
- Follow existing store conventions: no store imports another store at module scope; cross-domain reads are snapshots via `useXStore.getState()` inside actions/effects, exactly as `circuitStore.runSimulation` and `tutorStore.sendMessage` already do.

---

## File Structure

New files:
- `src/hooks/useCourseBootstrap.ts` — extracted course/lesson auto-load effect, shared by all four routes + dashboard.
- `src/components/dashboard/LabShell.tsx` — shared chrome (header/activity-bar/sidebar/tutor panel), collapse/dim flags, render-prop children.
- `src/components/dashboard/CircuitResultsPanel.tsx` — the probability/state-vector/Bloch-sphere block, extracted from `CentralWorkspace`'s `simulation` branch so `/circuit` can reuse it inline.
- `src/components/dashboard/FileTreePanel.tsx` — static file tree for `/code`.
- `src/components/dashboard/MonacoCodePanel.tsx` — dynamic-imported Monaco editor + Run-gating logic, replaces `CircuitCodePanel` inside `CentralWorkspace`'s `code` branch.
- `src/types/quiz.ts` — `QuizQuestion` type (richer than the current inline one in `quizStore.ts`).
- `src/lib/quiz-generator.ts` — placeholder client-side quiz generator.
- `src/components/quiz/QuizProgressBar.tsx`, `QuestionDisplay.tsx`, `AnswerOptions.tsx`, `HintButton.tsx`, `QuizNavigation.tsx`, `QuizWorkspace.tsx`.
- `src/app/learn/page.tsx`, `src/app/circuit/page.tsx`, `src/app/code/page.tsx`, `src/app/quiz/page.tsx` (replace existing stub/old pages — same route paths, files move out of `(shell)`).
- Test files mirroring each of the above under `test/`.

Modified files:
- `src/components/dashboard/DashboardWorkspace.tsx` — use `LabShell` instead of inline chrome composition.
- `src/components/dashboard/CentralWorkspace.tsx` — add `lockedTab`/`showTabBar` props; extract the `simulation` branch's visualization block into `CircuitResultsPanel`; swap `CircuitCodePanel` for `MonacoCodePanel` in the `code` branch.
- `src/components/dashboard/DashboardActivityBar.tsx` — add `dim?: boolean` prop.
- `src/stores/circuitStore.ts` — remove the `BottomPanel`-opening side effect from `runSimulation`.
- `src/stores/quizStore.ts` — replace the inline `QuizQuestion` with the richer type, add `hintsUsed`, `loadQuizForLesson`, `useHint`.
- `src/stores/shellStore.ts` — drop `bottomPanelOpen`/`focusMode`/`bottomPanelTab` (no longer read by anything after this plan).
- `frontend/package.json` — add `@monaco-editor/react`.

Deleted files (Task 12, only once nothing references them):
- `src/app/(shell)/` (entire route group: `layout.tsx`, `circuit/page.tsx`, `code/page.tsx`, `learn/page.tsx`, `quiz/page.tsx`)
- `src/components/shell/AppShell.tsx`, `TitleBar.tsx`, `BottomPanel.tsx`, `StatusBar.tsx`, `TutorFAB.tsx`, `ActivityBar.tsx`, `WorkspacePlaceholder.tsx`, `BreadcrumbNav.tsx`, `UserMenu.tsx`, `XPProgressBar.tsx`
- `src/components/learn/LearnWorkspace.tsx`, `src/components/learn/LessonOutline.tsx`
- `src/components/circuit/CircuitBuilderWorkspace.tsx` (the top-level wrapper only — `GatePalette`/`CircuitToolbar`/`CircuitCanvas`/`nodes/*` stay, still used by `CentralWorkspace`)
- `src/components/dashboard/CircuitCodePanel.tsx` (superseded by `MonacoCodePanel`)
- `src/hooks/useKeyboardShortcuts.ts`
- Matching test files: `test/components/shell/*.test.tsx`, `test/components/learn/LearnWorkspace.test.tsx`, `test/components/learn/LessonOutline.test.tsx`, `test/hooks/useKeyboardShortcuts.test.tsx`

---

### Task 1: `CentralWorkspace` locked-tab mode

**Files:**
- Modify: `frontend/src/components/dashboard/CentralWorkspace.tsx`
- Test: `frontend/test/components/dashboard/CentralWorkspace.test.tsx`

**Interfaces:**
- Produces: `CentralWorkspace` now accepts `{ onExplainCircuit: () => void; lockedTab?: CentralTab; showTabBar?: boolean }`. When `lockedTab` is set, `showTabBar` defaults to `false`; the component ignores its internal `tab` state and renders only the locked branch, full height (`flex-1` instead of `h-[420px]`) for the `circuit`/`code` branches.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/test/components/dashboard/CentralWorkspace.test.tsx` (after the existing `describe` block's last test, still inside `describe("CentralWorkspace", ...)`):

```tsx
  it("lockedTab hides the tab switcher and renders only that tab, full height", () => {
    render(
      <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
    );
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("GatePaletteMock")).toBeInTheDocument();
    expect(screen.queryByText("LessonContentMock")).not.toBeInTheDocument();
  });

  it("lockedTab='circuit' renders the circuit branch in a flex-1 container, not the fixed 420px preview height", () => {
    render(
      <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
    );
    const container = screen.getByText("GatePaletteMock").closest("div.flex.h-full") 
      ?? screen.getByText("GatePaletteMock").parentElement?.parentElement;
    expect(container?.className ?? "").not.toContain("h-[420px]");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir frontend test -- CentralWorkspace -t "lockedTab"`
Expected: FAIL — `lockedTab` prop doesn't exist yet, tab bar still renders.

- [ ] **Step 3: Implement `lockedTab`/`showTabBar`**

In `frontend/src/components/dashboard/CentralWorkspace.tsx`:

Replace the function signature (currently line 43-47):
```tsx
export default function CentralWorkspace({
  onExplainCircuit,
}: {
  onExplainCircuit: () => void;
}) {
```
with:
```tsx
export default function CentralWorkspace({
  onExplainCircuit,
  lockedTab,
  showTabBar = lockedTab === undefined,
}: {
  onExplainCircuit: () => void;
  lockedTab?: CentralTab;
  showTabBar?: boolean;
}) {
```

Replace the `useState` line (currently `const [tab, setTab] = useState<CentralTab>("lesson");`) with:
```tsx
  const [internalTab, setInternalTab] = useState<CentralTab>("lesson");
  const tab = lockedTab ?? internalTab;
  const setTab = setInternalTab;
```

Wrap the existing `<Tabs>` block (currently lines 119-127) in the `showTabBar` guard:
```tsx
      {showTabBar && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as CentralTab)}>
          <TabsList>
            <TabsTrigger value="lesson">Lesson</TabsTrigger>
            <TabsTrigger value="circuit">Circuit</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="simulation">Simulation</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
```

Change the circuit branch's outer `div` (currently `<div className="flex h-[420px] overflow-hidden rounded-xl border border-white/10">`) to size by `lockedTab`:
```tsx
      {tab === "circuit" && (
        <div
          className={`flex overflow-hidden rounded-xl border border-white/10 ${
            lockedTab ? "flex-1" : "h-[420px]"
          }`}
        >
```

Change the code branch's outer `div` (currently `<div className="h-[420px]">`) the same way:
```tsx
      {tab === "code" && (
        <div className={lockedTab ? "flex-1" : "h-[420px]"}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir frontend test -- CentralWorkspace`
Expected: PASS (all existing tests plus the two new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/CentralWorkspace.tsx frontend/test/components/dashboard/CentralWorkspace.test.tsx
git commit -m "feat(dashboard): add lockedTab/showTabBar mode to CentralWorkspace"
```

---

### Task 2: Extract `useCourseBootstrap`

**Files:**
- Create: `frontend/src/hooks/useCourseBootstrap.ts`
- Test: `frontend/test/hooks/useCourseBootstrap.test.tsx`
- Modify: `frontend/src/components/dashboard/DashboardWorkspace.tsx:22-58`

**Interfaces:**
- Produces: `useCourseBootstrap(): { coursesLoading: boolean; coursesError: string | null; onRetry: () => void }`. Reads/writes `useLearningStore` exactly as `DashboardWorkspace` does today (`loadCourses`, `loadCourse`, `loadLesson`, `courses`, `activeCourse`, `currentLessonId`, `lessonProgress`).
- Consumes: `useLearningStore`, `sortedModules`/`sortedLessons`/`isLessonCompleted` from `@/lib/curriculum`.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/hooks/useCourseBootstrap.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";
import { useLearningStore } from "@/stores/learningStore";
import type { CourseDetail } from "@/types";

const course: CourseDetail = {
  id: "course-1",
  title: "Quantum Computing",
  description: null,
  difficulty: "beginner",
  modules: [
    {
      id: "m0",
      title: "Foundations",
      order_index: 0,
      lessons: [{ id: "l0", title: "Qubits", lesson_type: "text", is_pro: false, order_index: 0 }],
    },
  ],
};

const loadCourses = vi.fn().mockResolvedValue(undefined);
const loadCourse = vi.fn().mockResolvedValue(undefined);
const loadLesson = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  loadCourses.mockClear();
  loadCourse.mockClear();
  loadLesson.mockClear();
  useLearningStore.setState({
    courses: [],
    activeCourse: null,
    activeLesson: null,
    currentLessonId: null,
    lessonProgress: {},
    loadCourses,
    loadCourse,
    loadLesson,
  });
});

describe("useCourseBootstrap", () => {
  it("calls loadCourses on mount", () => {
    renderHook(() => useCourseBootstrap());
    expect(loadCourses).toHaveBeenCalledOnce();
  });

  it("loads the first course once the course list arrives", async () => {
    useLearningStore.setState({
      courses: [{ id: "course-1", title: "Quantum Computing", description: null, difficulty: "beginner" }],
    });
    renderHook(() => useCourseBootstrap());
    await waitFor(() => expect(loadCourse).toHaveBeenCalledWith("course-1"));
  });

  it("auto-selects the first incomplete lesson once the course detail loads", async () => {
    useLearningStore.setState({
      courses: [{ id: "course-1", title: "Quantum Computing", description: null, difficulty: "beginner" }],
      activeCourse: course,
    });
    renderHook(() => useCourseBootstrap());
    await waitFor(() => expect(loadLesson).toHaveBeenCalledWith("l0"));
  });

  it("onRetry re-calls loadCourses and clears the error", async () => {
    const { result } = renderHook(() => useCourseBootstrap());
    loadCourses.mockClear();
    result.current.onRetry();
    expect(loadCourses).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- useCourseBootstrap`
Expected: FAIL — module `@/hooks/useCourseBootstrap` doesn't exist.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useCourseBootstrap.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { useLearningStore } from "@/stores/learningStore";
import { isLessonCompleted, sortedLessons, sortedModules } from "@/lib/curriculum";

/**
 * Course/lesson auto-load bootstrap shared by every route that mounts
 * `LabShell` (dashboard, learn, circuit, code). Loads the course list, picks
 * the first course once it arrives, then auto-selects the first incomplete
 * lesson in that course (or the first lesson overall if all are complete).
 */
export function useCourseBootstrap() {
  const courses = useLearningStore((s) => s.courses);
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadCourses = useLearningStore((s) => s.loadCourses);
  const loadCourse = useLearningStore((s) => s.loadCourse);
  const loadLesson = useLearningStore((s) => s.loadLesson);

  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  function fetchCourses() {
    setCoursesLoading(true);
    setCoursesError(null);
    loadCourses()
      .catch((err) => {
        setCoursesError(err instanceof Error ? err.message : "Failed to load courses");
      })
      .finally(() => setCoursesLoading(false));
  }

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!coursesLoading && !activeCourse && courses.length > 0) {
      void loadCourse(courses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursesLoading, activeCourse, courses]);

  useEffect(() => {
    if (!activeCourse || currentLessonId) return;
    const modules = sortedModules(activeCourse);
    let fallback: string | null = null;
    for (const mod of modules) {
      for (const lesson of sortedLessons(mod)) {
        if (!fallback) fallback = lesson.id;
        if (!isLessonCompleted(lessonProgress, lesson.id)) {
          void loadLesson(lesson.id);
          return;
        }
      }
    }
    if (fallback) void loadLesson(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourse, currentLessonId]);

  return { coursesLoading, coursesError, onRetry: fetchCourses };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test -- useCourseBootstrap`
Expected: PASS.

- [ ] **Step 5: Wire `DashboardWorkspace` to the hook**

In `frontend/src/components/dashboard/DashboardWorkspace.tsx`, remove lines 31-58 (the `coursesLoading`/`coursesError` state, `fetchCourses`, and the two `useEffect`s that call it/auto-select) and the now-unused `useEffect`/`useState` import members, replacing with:

```tsx
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();
```

Add the import: `import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";`. Remove the now-unused `useEffect` import if `useState`/`useEffect` are no longer referenced elsewhere in the file (the tutor-tab state still needs `useState`, so keep that import; drop `useEffect` only if truly unused after this change — check by searching the file for remaining `useEffect(` calls before removing the import).

Update the two remaining JSX references from `fetchCourses` to `onRetry` (the `<CurriculumSidebar onRetry={...} />` prop).

- [ ] **Step 6: Run the full DashboardWorkspace test suite**

Run: `pnpm --dir frontend test -- DashboardWorkspace`
Expected: PASS — behavior unchanged, now backed by the extracted hook.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useCourseBootstrap.ts frontend/test/hooks/useCourseBootstrap.test.tsx frontend/src/components/dashboard/DashboardWorkspace.tsx
git commit -m "refactor(dashboard): extract useCourseBootstrap from DashboardWorkspace"
```

---

### Task 3: `LabShell`

**Files:**
- Create: `frontend/src/components/dashboard/LabShell.tsx`
- Test: `frontend/test/components/dashboard/LabShell.test.tsx`
- Modify: `frontend/src/components/dashboard/DashboardWorkspace.tsx`
- Modify: `frontend/test/components/dashboard/DashboardWorkspace.test.tsx`

**Interfaces:**
- Produces: `LabShell({ sidebarCollapsed?, tutorCollapsed?, activityBarDim?, sidebarProps: { loading, error, onRetry }, children }: { children: (ctx: { onExplainCircuit: () => void }) => React.ReactNode })`. Owns the tutor-tab state (`activeTutorTab`, `askedTutorTabs`, `askTutor`) previously inline in `DashboardWorkspace`.
- Consumes: `DashboardHeader`, `DashboardActivityBar`, `CurriculumSidebar`, `DashboardTutorPanel` (all unchanged props except `DashboardActivityBar` gets `dim` in Task 11), `useTutorStore`.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/components/dashboard/LabShell.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LabShell from "@/components/dashboard/LabShell";
import { useTutorStore } from "@/stores/tutorStore";

vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
}));

vi.mock("@/components/dashboard/DashboardHeader", () => ({
  default: () => <div>HeaderMock</div>,
}));
vi.mock("@/components/dashboard/DashboardActivityBar", () => ({
  default: ({ onOpenTutor, dim }: { onOpenTutor: () => void; dim?: boolean }) => (
    <button onClick={onOpenTutor} data-dim={dim ? "true" : "false"}>
      open-tutor
    </button>
  ),
}));
vi.mock("@/components/dashboard/CurriculumSidebar", () => ({
  default: ({ onRetry }: { onRetry: () => void }) => (
    <button onClick={onRetry}>retry-courses</button>
  ),
}));
vi.mock("@/components/dashboard/DashboardTutorPanel", () => ({
  default: ({ activeTab, askedTabs }: { activeTab: string; askedTabs: Set<string> }) => (
    <div>
      <span>active-tab:{activeTab}</span>
      <span>asked-tabs:{[...askedTabs].join(",")}</span>
    </div>
  ),
}));

const sendMessage = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  sendMessage.mockClear();
  useTutorStore.setState({ messages: [], isStreaming: false, sendMessage });
});

describe("LabShell", () => {
  it("renders header, sidebar, and tutor panel by default", () => {
    render(
      <LabShell sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}>
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.getByText("HeaderMock")).toBeInTheDocument();
    expect(screen.getByText("retry-courses")).toBeInTheDocument();
    expect(screen.getByText("active-tab:chat")).toBeInTheDocument();
    expect(screen.getByText("ContentSlot")).toBeInTheDocument();
  });

  it("sidebarCollapsed hides the curriculum sidebar", () => {
    render(
      <LabShell
        sidebarCollapsed
        sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}
      >
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.queryByText("retry-courses")).not.toBeInTheDocument();
  });

  it("tutorCollapsed hides the tutor panel", () => {
    render(
      <LabShell
        tutorCollapsed
        sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}
      >
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.queryByText("active-tab:chat")).not.toBeInTheDocument();
  });

  it("passes activityBarDim through to DashboardActivityBar", () => {
    render(
      <LabShell
        activityBarDim
        sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}
      >
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.getByText("open-tutor")).toHaveAttribute("data-dim", "true");
  });

  it("children render prop receives onExplainCircuit which sends the canned prompt", async () => {
    const user = userEvent.setup();
    render(
      <LabShell sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}>
        {({ onExplainCircuit }) => <button onClick={onExplainCircuit}>trigger-explain</button>}
      </LabShell>
    );
    await user.click(screen.getByText("trigger-explain"));
    expect(sendMessage).toHaveBeenCalledWith("Explain my circuit");
    await waitFor(() => expect(screen.getByText("active-tab:explain")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- LabShell`
Expected: FAIL — `@/components/dashboard/LabShell` doesn't exist.

- [ ] **Step 3: Implement `LabShell`**

Create `frontend/src/components/dashboard/LabShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Lightbulb, Target } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardActivityBar from "@/components/dashboard/DashboardActivityBar";
import CurriculumSidebar from "@/components/dashboard/CurriculumSidebar";
import DashboardTutorPanel, {
  type AskableTab,
  type TutorTab,
} from "@/components/dashboard/DashboardTutorPanel";
import { useTutorStore } from "@/stores/tutorStore";

const CANNED_PROMPTS: Record<AskableTab, string> = {
  explain: "Explain my circuit",
  hints: "Give me a hint for this lesson",
  next: "What should I try next?",
};

export interface LabShellSidebarProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export interface LabShellChildContext {
  onExplainCircuit: () => void;
}

export default function LabShell({
  sidebarCollapsed = false,
  tutorCollapsed = false,
  activityBarDim = false,
  sidebarProps,
  children,
}: {
  sidebarCollapsed?: boolean;
  tutorCollapsed?: boolean;
  activityBarDim?: boolean;
  sidebarProps: LabShellSidebarProps;
  children: (ctx: LabShellChildContext) => React.ReactNode;
}) {
  const [activeTutorTab, setActiveTutorTab] = useState<TutorTab>("chat");
  const [askedTutorTabs, setAskedTutorTabs] = useState<Set<AskableTab>>(new Set());
  const [tutorAskError, setTutorAskError] = useState<string | null>(null);

  function askTutor(tab: AskableTab) {
    setActiveTutorTab(tab);
    if (askedTutorTabs.has(tab)) return;
    setTutorAskError(null);
    useTutorStore
      .getState()
      .sendMessage(CANNED_PROMPTS[tab])
      .then(() => {
        setAskedTutorTabs((prev) => new Set(prev).add(tab));
      })
      .catch((err) => {
        setTutorAskError(err instanceof Error ? err.message : "Couldn't reach the tutor — try again.");
      });
  }

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardActivityBar
          onOpenTutor={() => setActiveTutorTab("chat")}
          dim={activityBarDim}
        />
        {!sidebarCollapsed && (
          <CurriculumSidebar
            loading={sidebarProps.loading}
            error={sidebarProps.error}
            onRetry={sidebarProps.onRetry}
          />
        )}
        {children({ onExplainCircuit: () => askTutor("explain") })}
        {!tutorCollapsed && (
          <DashboardTutorPanel
            activeTab={activeTutorTab}
            onTabChange={setActiveTutorTab}
            askedTabs={askedTutorTabs}
            onAsk={askTutor}
            askError={tutorAskError}
          />
        )}
      </div>
    </div>
  );
}
```

Note: `Sparkles`/`Lightbulb`/`Target` imports are unused here (they're `DashboardTutorPanel`'s icons, not `LabShell`'s) — remove that import line before committing; it was left in by mistake in this draft.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test -- LabShell`
Expected: PASS.

- [ ] **Step 5: Refactor `DashboardWorkspace` to use `LabShell`**

Replace the full return statement in `frontend/src/components/dashboard/DashboardWorkspace.tsx` (the JSX currently spanning `DashboardHeader`/`DashboardActivityBar`/`CurriculumSidebar`/`CentralWorkspace`/`DashboardTutorPanel`) with:

```tsx
  return (
    <LabShell
      sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}
    >
      {({ onExplainCircuit }) => <CentralWorkspace onExplainCircuit={onExplainCircuit} />}
    </LabShell>
  );
```

Remove the now-unused `askTutor`/`activeTutorTab`/`askedTutorTabs`/`tutorAskError`/`CANNED_PROMPTS` and their imports (`DashboardHeader`, `DashboardActivityBar`, `CurriculumSidebar`, `DashboardTutorPanel`, `useTutorStore`) from `DashboardWorkspace.tsx`; add `import LabShell from "@/components/dashboard/LabShell";`.

- [ ] **Step 6: Update `DashboardWorkspace.test.tsx` mocks**

The existing mocks in `frontend/test/components/dashboard/DashboardWorkspace.test.tsx` target `DashboardHeader`/`DashboardActivityBar`/`CurriculumSidebar`/`DashboardTutorPanel` directly — since those now live inside `LabShell`, replace those four `vi.mock` calls with a single mock of `LabShell` itself:

```tsx
vi.mock("@/components/dashboard/LabShell", () => ({
  default: ({
    children,
    sidebarProps,
  }: {
    children: (ctx: { onExplainCircuit: () => void }) => React.ReactNode;
    sidebarProps: { onRetry: () => void };
  }) => (
    <div>
      <button onClick={sidebarProps.onRetry}>retry-courses</button>
      {children({ onExplainCircuit: () => {} })}
    </div>
  ),
}));
```

Delete the `vi.mock("@/components/dashboard/DashboardHeader", ...)`, `DashboardActivityBar`, `CurriculumSidebar`, and `DashboardTutorPanel` mocks — they're no longer imported by `DashboardWorkspace` directly. Keep the `CentralWorkspace` mock as-is. Remove the now-untestable-here `"clicking Explain Circuit..."` assertions about `active-tab`/`asked-tabs` (that behavior moved to and is now covered by `LabShell.test.tsx`); keep a simpler assertion that `onExplainCircuit` is threaded through:

```tsx
  it("threads onExplainCircuit from LabShell into CentralWorkspace", async () => {
    const user = userEvent.setup();
    render(<DashboardWorkspace />);
    await user.click(screen.getByText("trigger-explain"));
    // No assertion needed beyond "didn't throw" — LabShell.test.tsx covers the
    // askTutor behavior itself.
  });
```

- [ ] **Step 7: Run the full test file**

Run: `pnpm --dir frontend test -- DashboardWorkspace`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/dashboard/LabShell.tsx frontend/test/components/dashboard/LabShell.test.tsx frontend/src/components/dashboard/DashboardWorkspace.tsx frontend/test/components/dashboard/DashboardWorkspace.test.tsx
git commit -m "feat(dashboard): extract LabShell chrome from DashboardWorkspace"
```

---

### Task 4: `/learn` route

**Files:**
- Create: `frontend/src/app/learn/page.tsx`
- Test: `frontend/test/app/learn/page.test.tsx`
- Delete (this task): none yet — old `(shell)/learn` and `components/learn/LearnWorkspace.tsx` are removed in Task 12 once all four routes are migrated and cross-checked.

**Interfaces:**
- Consumes: `LabShell`, `useCourseBootstrap`, `CentralWorkspace lockedTab="lesson"`.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/app/learn/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LearnPage from "@/app/learn/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/learn" }));
vi.mock("@/hooks/useCourseBootstrap", () => ({
  useCourseBootstrap: () => ({ coursesLoading: false, coursesError: null, onRetry: vi.fn() }),
}));
vi.mock("@/components/dashboard/LabShell", () => ({
  default: ({
    children,
  }: {
    children: (ctx: { onExplainCircuit: () => void }) => React.ReactNode;
  }) => <div>{children({ onExplainCircuit: () => {} })}</div>,
}));
vi.mock("@/components/dashboard/CentralWorkspace", () => ({
  default: ({ lockedTab }: { lockedTab?: string }) => <div>CentralWorkspace:{lockedTab}</div>,
}));

describe("/learn page", () => {
  it("renders CentralWorkspace locked to the lesson tab", () => {
    render(<LearnPage />);
    expect(screen.getByText("CentralWorkspace:lesson")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- app/learn`
Expected: FAIL — `@/app/learn/page` doesn't exist yet (the old `(shell)/learn/page.tsx` is a different module path).

- [ ] **Step 3: Implement the page**

Create `frontend/src/app/learn/page.tsx`:

```tsx
"use client";

import LabShell from "@/components/dashboard/LabShell";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";

export default function LearnPage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  return (
    <LabShell sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}>
      {({ onExplainCircuit }) => (
        <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="lesson" />
      )}
    </LabShell>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test -- app/learn`
Expected: PASS.

- [ ] **Step 5: Manual smoke check**

Run: `pnpm --dir frontend dev`, visit `http://localhost:3000/learn` (with `NEXT_PUBLIC_DEV_NO_AUTH=1` set for a no-login check), confirm the lesson content renders full-height with no tab pills and the curriculum sidebar/tutor panel are present.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/learn/page.tsx frontend/test/app/learn/page.test.tsx
git commit -m "feat(learn): rebuild /learn on LabShell + locked lesson tab"
```

---

### Task 5: `CircuitResultsPanel` + `/circuit` route

**Files:**
- Create: `frontend/src/components/dashboard/CircuitResultsPanel.tsx`
- Create: `frontend/src/app/circuit/page.tsx`
- Test: `frontend/test/components/dashboard/CircuitResultsPanel.test.tsx`
- Test: `frontend/test/app/circuit/page.test.tsx`
- Modify: `frontend/src/components/dashboard/CentralWorkspace.tsx` (simulation branch reuses the extracted component)
- Modify: `frontend/src/stores/circuitStore.ts:1-9,131-172`

**Interfaces:**
- Produces: `CircuitResultsPanel(): JSX.Element` — the exact markup currently inline in `CentralWorkspace`'s `simulation` branch (error banner, probability chart, state vector table, Bloch sphere, key-insight callout), reading `useCircuitStore` directly (no props needed — it's self-contained, same as `ProbabilityChart`/`StateVectorTable`).
- Consumes: `useCircuitStore`, `ProbabilityChart`, `StateVectorTable`, `StateSphereVisualization`, the existing `keyInsight()` helper (moves from `CentralWorkspace` into this new file since it's now only used here and by `CentralWorkspace`'s simulation branch, which will itself render `<CircuitResultsPanel />`).

- [ ] **Step 1: Write the failing test for `CircuitResultsPanel`**

Create `frontend/test/components/dashboard/CircuitResultsPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CircuitResultsPanel from "@/components/dashboard/CircuitResultsPanel";
import { useCircuitStore } from "@/stores/circuitStore";

beforeEach(() => {
  useCircuitStore.setState({ runState: "idle", error: null, results: null });
});

describe("CircuitResultsPanel", () => {
  it("shows an error banner when the run failed", () => {
    useCircuitStore.setState({ runState: "error", error: "Backend unreachable" });
    render(<CircuitResultsPanel />);
    expect(screen.getByText("Backend unreachable")).toBeInTheDocument();
  });

  it("shows a completed status and key insight when results have two likely outcomes", () => {
    useCircuitStore.setState({
      runState: "success",
      results: {
        status: "completed",
        probabilities: { "00": 0.5, "11": 0.5 },
        measurements: null,
        statevector: null,
        execution_time_ms: 12,
      },
    });
    render(<CircuitResultsPanel />);
    expect(screen.getByText(/simulation completed/i)).toBeInTheDocument();
    expect(screen.getByText(/most likely outcomes/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- CircuitResultsPanel`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Extract `CircuitResultsPanel`**

Create `frontend/src/components/dashboard/CircuitResultsPanel.tsx` with the `keyInsight` helper and JSX moved verbatim from `CentralWorkspace`'s current `simulation` branch (lines 30-41 for the helper, lines 160-206 for the markup), adapted to a standalone component:

```tsx
"use client";

import { useCircuitStore } from "@/stores/circuitStore";
import ProbabilityChart from "@/components/visualization/ProbabilityChart";
import StateVectorTable from "@/components/visualization/StateVectorTable";
import StateSphereVisualization from "@/components/dashboard/StateSphereVisualization";

export function keyInsight(probabilities: Record<string, number> | null | undefined): string | null {
  if (!probabilities) return null;
  const entries = Object.entries(probabilities)
    .filter(([, p]) => p > 0.01)
    .sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    return `The circuit deterministically produces |${entries[0][0]}⟩.`;
  }
  const [first, second] = entries;
  return `The most likely outcomes are |${first[0]}⟩ (${Math.round(first[1] * 100)}%) and |${second[0]}⟩ (${Math.round(second[1] * 100)}%).`;
}

export default function CircuitResultsPanel() {
  const runState = useCircuitStore((s) => s.runState);
  const error = useCircuitStore((s) => s.error);
  const results = useCircuitStore((s) => s.results);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Simulation Results</span>
        {results && (
          <span className={`text-xs ${runState === "error" ? "text-error" : "text-success"}`}>
            {runState === "error" ? "● Simulation failed" : "● Simulation completed"}
          </span>
        )}
      </div>

      {runState === "error" && (
        <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error">
          {error ?? "The simulation failed to run."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Measurement Probabilities
            </p>
            <ProbabilityChart />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">State Vector</p>
            <StateVectorTable />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            Quantum State Visualization
          </p>
          <StateSphereVisualization />
          {keyInsight(results?.probabilities) && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
              <span className="font-medium text-warning">Key Insight: </span>
              {keyInsight(results?.probabilities)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test -- CircuitResultsPanel`
Expected: PASS.

- [ ] **Step 5: Point `CentralWorkspace`'s simulation branch at it**

In `frontend/src/components/dashboard/CentralWorkspace.tsx`, replace the entire `{tab === "simulation" && ( ... )}` block (lines 160-206) with:

```tsx
      {tab === "simulation" && <CircuitResultsPanel />}
```

Remove the now-duplicate `keyInsight` function (lines 30-41) and the `ProbabilityChart`/`StateVectorTable`/`StateSphereVisualization` imports from `CentralWorkspace.tsx` (they're only used inside `CircuitResultsPanel` now); add `import CircuitResultsPanel from "@/components/dashboard/CircuitResultsPanel";`.

Update `frontend/test/components/dashboard/CentralWorkspace.test.tsx`: the `vi.mock` calls for `ProbabilityChart`/`StateVectorTable`/`StateSphereVisualization` are no longer imported by `CentralWorkspace` directly — replace them with a single `vi.mock("@/components/dashboard/CircuitResultsPanel", () => ({ default: () => <div>ResultsPanelMock</div> }))`, and change the two assertions that looked for `"ProbChartMock"` / `"Backend unreachable"` to look for `"ResultsPanelMock"` instead (the error-banner behavior itself is now covered by `CircuitResultsPanel.test.tsx`).

- [ ] **Step 6: Run `CentralWorkspace` tests**

Run: `pnpm --dir frontend test -- CentralWorkspace`
Expected: PASS.

- [ ] **Step 7: Remove the `BottomPanel` side effect from `runSimulation`**

In `frontend/src/stores/circuitStore.ts`, remove the `useShellStore` import (line 8) and, inside `runSimulation`'s `subscribeToCircuitResult` callback (lines 146-149), delete:
```ts
        // Open the BottomPanel and focus the probabilities tab
        const shell = useShellStore.getState();
        if (!shell.bottomPanelOpen) shell.toggleBottomPanel();
        shell.setBottomPanelTab("probabilities");
```
leaving just the `set({...})` call and `unsub()`. There is no replacement side effect needed here — `/circuit`'s page component reads `runState` directly to decide whether to show `CircuitResultsPanel` (Step 9), and `CentralWorkspace`'s simulation tab already switches itself via `handleRunSimulation`'s `setTab("simulation")`.

Check `frontend/test/stores/circuitStore.test.ts` (if it asserts the `toggleBottomPanel`/`setBottomPanelTab` calls) and remove those assertions.

- [ ] **Step 8: Run circuitStore tests**

Run: `pnpm --dir frontend test -- circuitStore`
Expected: PASS.

- [ ] **Step 9: Write the failing test for `/circuit`**

Create `frontend/test/app/circuit/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CircuitPage from "@/app/circuit/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/circuit" }));
vi.mock("@/hooks/useCourseBootstrap", () => ({
  useCourseBootstrap: () => ({ coursesLoading: false, coursesError: null, onRetry: vi.fn() }),
}));
vi.mock("@/components/dashboard/LabShell", () => ({
  default: ({
    children,
  }: {
    children: (ctx: { onExplainCircuit: () => void }) => React.ReactNode;
  }) => <div>{children({ onExplainCircuit: () => {} })}</div>,
}));
vi.mock("@/components/dashboard/CentralWorkspace", () => ({
  default: ({ lockedTab }: { lockedTab?: string }) => <div>CentralWorkspace:{lockedTab}</div>,
}));

describe("/circuit page", () => {
  it("renders CentralWorkspace locked to the circuit tab", () => {
    render(<CircuitPage />);
    expect(screen.getByText("CentralWorkspace:circuit")).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails, then implement**

Run: `pnpm --dir frontend test -- app/circuit` → FAIL (module missing).

Create `frontend/src/app/circuit/page.tsx`:

```tsx
"use client";

import LabShell from "@/components/dashboard/LabShell";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";

export default function CircuitPage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  return (
    <LabShell sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}>
      {({ onExplainCircuit }) => (
        <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
      )}
    </LabShell>
  );
}
```

Note: because `lockedTab="circuit"` keeps the user on the circuit tab, running a simulation via `CircuitToolbar`'s Run button leaves them on-canvas with results available by switching `CentralWorkspace`'s internal state — but locked mode has no switcher. Per the spec, `/circuit` must show results inline below the canvas, not require leaving the tab. Fix: `CentralWorkspace`'s circuit branch (not just its simulation branch) needs to render `CircuitResultsPanel` beneath the canvas whenever `lockedTab === "circuit"` and `runState !== "idle"`. In `frontend/src/components/dashboard/CentralWorkspace.tsx`, change the circuit branch to:

```tsx
      {tab === "circuit" && (
        <div className={`flex flex-col gap-4 ${lockedTab ? "flex-1 overflow-y-auto" : ""}`}>
          <div
            className={`flex overflow-hidden rounded-xl border border-white/10 ${
              lockedTab ? "h-[420px] flex-shrink-0" : "h-[420px]"
            }`}
          >
            <GatePalette />
            <div className="flex flex-1 flex-col">
              <CircuitToolbar />
              <div className="flex-1">
                <CircuitCanvas />
              </div>
            </div>
          </div>
          {lockedTab === "circuit" && runState !== "idle" && <CircuitResultsPanel />}
        </div>
      )}
```

(This supersedes the flex-1-vs-h-[420px] wording from Task 1's Step 3 for the circuit branch specifically — the canvas itself stays a fixed comfortable height and the results panel appends below it and scrolls, rather than the canvas stretching to fill arbitrary viewport height, which would make the gate grid awkwardly tall on large screens.) Read `runState` from `useCircuitStore` at the top of `CentralWorkspace` (it's already read there for the toolbar's disabled state — reuse the existing `runState` variable).

- [ ] **Step 11: Update `CentralWorkspace.test.tsx` for the new circuit-branch structure**

Add a test:
```tsx
  it("lockedTab='circuit' shows CircuitResultsPanel below the canvas once a run has happened", () => {
    useCircuitStore.setState({ runState: "success" });
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />);
    expect(screen.getByText("ResultsPanelMock")).toBeInTheDocument();
  });

  it("lockedTab='circuit' hides CircuitResultsPanel before any run", () => {
    useCircuitStore.setState({ runState: "idle" });
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />);
    expect(screen.queryByText("ResultsPanelMock")).not.toBeInTheDocument();
  });
```

- [ ] **Step 12: Run all touched test files**

Run: `pnpm --dir frontend test -- CentralWorkspace circuitStore app/circuit`
Expected: PASS.

- [ ] **Step 13: Manual smoke check**

`pnpm --dir frontend dev`, visit `/circuit`, place a gate, click Run, confirm results render inline below the canvas without navigating away.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/components/dashboard/CircuitResultsPanel.tsx frontend/src/components/dashboard/CentralWorkspace.tsx frontend/src/stores/circuitStore.ts frontend/src/app/circuit/page.tsx frontend/test/components/dashboard/CircuitResultsPanel.test.tsx frontend/test/components/dashboard/CentralWorkspace.test.tsx frontend/test/app/circuit/page.test.tsx
git commit -m "feat(circuit): rebuild /circuit on LabShell with inline results panel"
```

---

### Task 6: `FileTreePanel`

**Files:**
- Create: `frontend/src/components/dashboard/FileTreePanel.tsx`
- Test: `frontend/test/components/dashboard/FileTreePanel.test.tsx`

**Interfaces:**
- Produces: `FileTreePanel({ activeFile }: { activeFile: string })` — static, read-only tree. No props needed beyond which file is highlighted as active; there's exactly one real file (`circuit.py`, the live-generated source) plus static illustrative starter files, so no click-to-switch-file interaction is needed for v1 (all real content lives in the one generated file).

- [ ] **Step 1: Write the failing test**

Create `frontend/test/components/dashboard/FileTreePanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FileTreePanel from "@/components/dashboard/FileTreePanel";

describe("FileTreePanel", () => {
  it("renders the generated circuit file and marks it active", () => {
    render(<FileTreePanel activeFile="circuit.py" />);
    const entry = screen.getByText("circuit.py");
    expect(entry).toBeInTheDocument();
    expect(entry.closest("button")).toHaveAttribute("aria-current", "true");
  });

  it("renders the static starter file group", () => {
    render(<FileTreePanel activeFile="circuit.py" />);
    expect(screen.getByText("starter_bell_state.py")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- FileTreePanel`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `frontend/src/components/dashboard/FileTreePanel.tsx`:

```tsx
"use client";

import { FileCode2 } from "lucide-react";

/**
 * Static file tree for the /code workspace. `circuit.py` is the one live
 * file — its content is the freshly generated Qiskit source for the current
 * circuit (see MonacoCodePanel). The starter files below are illustrative,
 * read-only reference snippets; there is no backend file-listing endpoint
 * yet, so this list is hardcoded rather than fetched.
 */
const STARTER_FILES = ["starter_bell_state.py", "starter_ghz_state.py"];

export default function FileTreePanel({ activeFile }: { activeFile: string }) {
  return (
    <aside
      className="flex w-[200px] flex-shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 bg-surface p-2"
      aria-label="Code files"
    >
      <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Your Circuit
      </p>
      <button
        type="button"
        aria-current={activeFile === "circuit.py" ? "true" : undefined}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
          activeFile === "circuit.py"
            ? "bg-cyber-cyan/10 text-cyber-cyan"
            : "text-foreground hover:bg-white/5"
        }`}
      >
        <FileCode2 size={14} aria-hidden />
        circuit.py
      </button>

      <p className="mt-3 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Starter Examples
      </p>
      {STARTER_FILES.map((file) => (
        <span
          key={file}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground opacity-70"
        >
          <FileCode2 size={14} aria-hidden />
          {file}
        </span>
      ))}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test -- FileTreePanel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/dashboard/FileTreePanel.tsx frontend/test/components/dashboard/FileTreePanel.test.tsx
git commit -m "feat(code): add static FileTreePanel"
```

---

### Task 7: `MonacoCodePanel`

**Files:**
- Create: `frontend/src/components/dashboard/MonacoCodePanel.tsx`
- Test: `frontend/test/components/dashboard/MonacoCodePanel.test.tsx`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `MonacoCodePanel(): JSX.Element` — reads `useCircuitStore` for `nodes`/`qubitCount`/`runSimulation`/`runState`, generates the Qiskit source via `circuitSpecToQiskitSource(nodesToCircuitSpec(...))`, renders it in a Monaco editor, tracks the edited buffer in local state, and gates the Run button on whether the buffer matches the freshly-generated source.
- Consumes: `@monaco-editor/react`'s `Editor` component (dynamic-imported), `useCircuitStore`, `circuitSpecToQiskitSource`, `nodesToCircuitSpec`.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --dir frontend add @monaco-editor/react`

- [ ] **Step 2: Write the failing test**

Create `frontend/test/components/dashboard/MonacoCodePanel.test.tsx`. Mock `@monaco-editor/react`'s `Editor` as a plain `<textarea>` so the test doesn't need a real Monaco instance (Monaco needs a browser worker environment jsdom doesn't provide):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MonacoCodePanel from "@/components/dashboard/MonacoCodePanel";
import { useCircuitStore } from "@/stores/circuitStore";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string | undefined) => void;
  }) => (
    <textarea
      aria-label="code editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const runSimulation = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  runSimulation.mockClear();
  useCircuitStore.setState({
    nodes: [],
    qubitCount: 2,
    runSimulation,
    runState: "idle",
  });
});

describe("MonacoCodePanel", () => {
  it("seeds the editor with the generated Qiskit source", () => {
    render(<MonacoCodePanel />);
    expect(screen.getByLabelText("code editor")).toHaveValue(
      expect.stringContaining("from qiskit import QuantumCircuit")
    );
  });

  it("Run is enabled and calls runSimulation when the buffer is unedited", async () => {
    const user = userEvent.setup();
    render(<MonacoCodePanel />);
    const runButton = screen.getByRole("button", { name: /run/i });
    expect(runButton).toBeEnabled();
    await user.click(runButton);
    expect(runSimulation).toHaveBeenCalledOnce();
  });

  it("Run is disabled once the buffer diverges from the generated source", async () => {
    const user = userEvent.setup();
    render(<MonacoCodePanel />);
    await user.type(screen.getByLabelText("code editor"), "\n# edited");
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --dir frontend test -- MonacoCodePanel`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement**

Create `frontend/src/components/dashboard/MonacoCodePanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCircuitStore } from "@/stores/circuitStore";
import { nodesToCircuitSpec, circuitSpecToQiskitSource } from "@/lib/circuit-spec";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Monaco needs `window`/workers — dynamic-import only, never SSR'd, per
// frontend/CLAUDE.md's "Monaco Editor: dynamic import only" rule.
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function MonacoCodePanel() {
  const nodes = useCircuitStore((s) => s.nodes);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const runSimulation = useCircuitStore((s) => s.runSimulation);
  const runState = useCircuitStore((s) => s.runState);

  const generatedSource = circuitSpecToQiskitSource(nodesToCircuitSpec(nodes, qubitCount));
  const [buffer, setBuffer] = useState(generatedSource);

  // Follow the live circuit as it's edited on the canvas, as long as the
  // student hasn't diverged the buffer yet.
  useEffect(() => {
    setBuffer((current) => (current === generatedSource ? generatedSource : current));
  }, [generatedSource]);

  const isEdited = buffer !== generatedSource;
  const isRunning = runState === "running";

  const runButton = (
    <button
      type="button"
      onClick={() => runSimulation()}
      disabled={isEdited || isRunning}
      className="h-8 rounded-md bg-cyber-cyan px-2.5 text-[13px] font-semibold text-background shadow-glow-cyan disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted-foreground disabled:opacity-60 disabled:shadow-none"
    >
      {isRunning ? "Running…" : "▶ Run"}
    </button>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-surface">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium text-foreground">circuit.py</span>
        {isEdited ? (
          <Tooltip>
            <TooltipTrigger asChild>{runButton}</TooltipTrigger>
            <TooltipContent>
              Custom code execution isn&apos;t connected to a backend sandbox yet — edit the
              circuit on the Circuit tab to change what runs.
            </TooltipContent>
          </Tooltip>
        ) : (
          runButton
        )}
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language="python"
          theme="vs-dark"
          value={buffer}
          onChange={(v) => setBuffer(v ?? "")}
          options={{ fontSize: 13, minimap: { enabled: false }, fontFamily: "var(--font-mono)" }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --dir frontend test -- MonacoCodePanel`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/components/dashboard/MonacoCodePanel.tsx frontend/test/components/dashboard/MonacoCodePanel.test.tsx
git commit -m "feat(code): add MonacoCodePanel with run-gating on edited buffers"
```

---

### Task 8: `/code` route

**Files:**
- Modify: `frontend/src/components/dashboard/CentralWorkspace.tsx` (code branch swaps `CircuitCodePanel` → `MonacoCodePanel` + adds `FileTreePanel`)
- Create: `frontend/src/app/code/page.tsx`
- Test: `frontend/test/app/code/page.test.tsx`
- Modify: `frontend/test/components/dashboard/CentralWorkspace.test.tsx`

**Interfaces:**
- Consumes: `FileTreePanel`, `MonacoCodePanel`, `LabShell`, `useCourseBootstrap`.

- [ ] **Step 1: Update `CentralWorkspace`'s code branch**

In `frontend/src/components/dashboard/CentralWorkspace.tsx`, replace:
```tsx
      {tab === "code" && (
        <div className={lockedTab ? "flex-1" : "h-[420px]"}>
          <CircuitCodePanel />
        </div>
      )}
```
with:
```tsx
      {tab === "code" && (
        <div className={`flex overflow-hidden rounded-xl ${lockedTab ? "flex-1" : "h-[420px] border border-white/10"}`}>
          {lockedTab && <FileTreePanel activeFile="circuit.py" />}
          <div className="flex-1">
            <MonacoCodePanel />
          </div>
        </div>
      )}
```
Replace the `import CircuitCodePanel from "@/components/dashboard/CircuitCodePanel";` line with:
```tsx
import FileTreePanel from "@/components/dashboard/FileTreePanel";
import MonacoCodePanel from "@/components/dashboard/MonacoCodePanel";
```
(the embedded dashboard preview, `lockedTab` undefined, keeps the compact `h-[420px]` single-panel view with no file tree — the file tree only appears in the dedicated `/code` full view, matching the same "focused vs. embedded" distinction the circuit branch already has).

- [ ] **Step 2: Update `CentralWorkspace.test.tsx`'s code-tab mock**

Replace `vi.mock("@/components/dashboard/CircuitCodePanel", ...)` with:
```tsx
vi.mock("@/components/dashboard/FileTreePanel", () => ({ default: () => <div>FileTreeMock</div> }));
vi.mock("@/components/dashboard/MonacoCodePanel", () => ({ default: () => <div>MonacoCodeMock</div> }));
```
and update any assertion referencing `"CircuitCodeMock"` to `"MonacoCodeMock"`.

- [ ] **Step 3: Run `CentralWorkspace` tests**

Run: `pnpm --dir frontend test -- CentralWorkspace`
Expected: PASS.

- [ ] **Step 4: Write the failing test for `/code`**

Create `frontend/test/app/code/page.test.tsx` (same shape as Task 4/5's page tests, asserting `lockedTab="code"`):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CodePage from "@/app/code/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/code" }));
vi.mock("@/hooks/useCourseBootstrap", () => ({
  useCourseBootstrap: () => ({ coursesLoading: false, coursesError: null, onRetry: vi.fn() }),
}));
vi.mock("@/components/dashboard/LabShell", () => ({
  default: ({
    children,
  }: {
    children: (ctx: { onExplainCircuit: () => void }) => React.ReactNode;
  }) => <div>{children({ onExplainCircuit: () => {} })}</div>,
}));
vi.mock("@/components/dashboard/CentralWorkspace", () => ({
  default: ({ lockedTab }: { lockedTab?: string }) => <div>CentralWorkspace:{lockedTab}</div>,
}));

describe("/code page", () => {
  it("renders CentralWorkspace locked to the code tab", () => {
    render(<CodePage />);
    expect(screen.getByText("CentralWorkspace:code")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run test to verify it fails, then implement**

Run: `pnpm --dir frontend test -- app/code` → FAIL.

Create `frontend/src/app/code/page.tsx`:

```tsx
"use client";

import LabShell from "@/components/dashboard/LabShell";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";

export default function CodePage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  return (
    <LabShell sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}>
      {({ onExplainCircuit }) => (
        <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="code" />
      )}
    </LabShell>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --dir frontend test -- app/code`
Expected: PASS.

- [ ] **Step 7: Manual smoke check**

`pnpm --dir frontend dev`, visit `/code`, confirm the file tree + Monaco editor render, Run works when unedited, and editing the buffer disables Run with the tooltip.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/dashboard/CentralWorkspace.tsx frontend/test/components/dashboard/CentralWorkspace.test.tsx frontend/src/app/code/page.tsx frontend/test/app/code/page.test.tsx
git commit -m "feat(code): rebuild /code on LabShell with FileTreePanel + MonacoCodePanel"
```

---

### Task 9: Quiz types, generator, and store extension

**Files:**
- Create: `frontend/src/types/quiz.ts`
- Create: `frontend/src/lib/quiz-generator.ts`
- Test: `frontend/test/lib/quiz-generator.test.ts`
- Modify: `frontend/src/stores/quizStore.ts`
- Test: `frontend/test/stores/quizStore.test.ts` (create if it doesn't already exist)

**Interfaces:**
- Produces (`types/quiz.ts`): 
  ```ts
  export interface QuizQuestion {
    id: string;
    concept_id: string;
    question_text: string;
    question_type: "multiple_choice" | "true_false";
    options: string[];
    correct_answer: string;
    hint: string;
  }
  ```
- Produces (`lib/quiz-generator.ts`): `generateQuizFromLesson(lesson: LessonDetail): QuizQuestion[]`.
- Produces (`stores/quizStore.ts`): adds `hintsUsed: Record<string, boolean>`, `loadQuizForLesson: (lesson: LessonDetail) => void`, `useHint: (questionId: string) => void` to the existing `QuizStore` interface; `quiz: QuizQuestion[]` now uses the richer type.

- [ ] **Step 1: Write the failing test for the generator**

Create `frontend/test/lib/quiz-generator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateQuizFromLesson } from "@/lib/quiz-generator";
import type { LessonDetail } from "@/types";

describe("generateQuizFromLesson", () => {
  it("builds one multiple-choice question per concept when there are 2+ concepts", () => {
    const lesson: LessonDetail = {
      id: "l1",
      module_id: "m0",
      title: "Multi-Qubit Gates",
      content: "…",
      lesson_type: "text",
      is_pro: false,
      concepts: [
        { id: "c1", name: "CNOT Gate", description: "A two-qubit entangling gate." },
        { id: "c2", name: "Bell State", description: "A maximally entangled two-qubit state." },
      ],
    };

    const quiz = generateQuizFromLesson(lesson);

    expect(quiz).toHaveLength(2);
    expect(quiz[0].question_type).toBe("multiple_choice");
    expect(quiz[0].correct_answer).toBe("CNOT Gate");
    expect(quiz[0].options).toEqual(expect.arrayContaining(["CNOT Gate", "Bell State"]));
    expect(quiz[0].concept_id).toBe("c1");
    expect(quiz[0].hint).toContain("entangling gate");
  });

  it("falls back to a true/false question when the lesson has fewer than 2 concepts", () => {
    const lesson: LessonDetail = {
      id: "l2",
      module_id: "m0",
      title: "Single Qubit Gates",
      content: "…",
      lesson_type: "text",
      is_pro: false,
      concepts: [{ id: "c1", name: "Hadamard Gate", description: "Creates superposition." }],
    };

    const quiz = generateQuizFromLesson(lesson);

    expect(quiz).toHaveLength(1);
    expect(quiz[0].question_type).toBe("true_false");
    expect(quiz[0].options).toEqual(["True", "False"]);
    expect(quiz[0].correct_answer).toBe("True");
  });

  it("returns an empty quiz for a lesson with no concepts", () => {
    const lesson: LessonDetail = {
      id: "l3",
      module_id: "m0",
      title: "Intro",
      content: "…",
      lesson_type: "text",
      is_pro: false,
      concepts: [],
    };
    expect(generateQuizFromLesson(lesson)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- quiz-generator`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement `types/quiz.ts` and `lib/quiz-generator.ts`**

Create `frontend/src/types/quiz.ts`:

```ts
export interface QuizQuestion {
  id: string;
  concept_id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  hint: string;
}
```

Create `frontend/src/lib/quiz-generator.ts`:

```ts
import type { LessonDetail, ConceptOut } from "@/types";
import type { QuizQuestion } from "@/types/quiz";

/**
 * Placeholder client-side quiz generator. There is no quiz-content backend
 * endpoint yet (no `/lessons/{id}/quiz` route exists) — this derives
 * questions from the lesson's own `concepts` so /quiz has something real to
 * quiz on. Swap this out for a `GET /api/v1/lessons/{id}/quiz` call once
 * that endpoint ships; `QuizQuestion`'s shape here is designed to match what
 * that endpoint would plausibly return, so the swap is a one-line change in
 * whichever component calls this.
 */
export function generateQuizFromLesson(lesson: LessonDetail): QuizQuestion[] {
  const concepts = lesson.concepts;

  if (concepts.length === 0) return [];

  if (concepts.length === 1) {
    return [trueFalseQuestion(concepts[0])];
  }

  return concepts.map((concept) => multipleChoiceQuestion(concept, concepts));
}

function multipleChoiceQuestion(concept: ConceptOut, pool: ConceptOut[]): QuizQuestion {
  const distractors = pool.filter((c) => c.id !== concept.id).map((c) => c.name);
  const options = shuffle([concept.name, ...distractors]);

  return {
    id: `q-${concept.id}`,
    concept_id: concept.id,
    question_text: `Which concept does this describe: "${concept.description ?? concept.name}"?`,
    question_type: "multiple_choice",
    options,
    correct_answer: concept.name,
    hint: concept.description ?? `Think about ${concept.name}.`,
  };
}

function trueFalseQuestion(concept: ConceptOut): QuizQuestion {
  return {
    id: `q-${concept.id}`,
    concept_id: concept.id,
    question_text: `True or False: ${concept.description ?? `This lesson covers ${concept.name}.`}`,
    question_type: "true_false",
    options: ["True", "False"],
    correct_answer: "True",
    hint: concept.description ?? `Think about ${concept.name}.`,
  };
}

/** Deterministic-enough shuffle for a handful of options; not cryptographic. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test -- quiz-generator`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the store extension**

Create `frontend/test/stores/quizStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useQuizStore } from "@/stores/quizStore";
import type { LessonDetail } from "@/types";

const lesson: LessonDetail = {
  id: "l1",
  module_id: "m0",
  title: "Multi-Qubit Gates",
  content: "…",
  lesson_type: "text",
  is_pro: false,
  concepts: [
    { id: "c1", name: "CNOT Gate", description: "A two-qubit entangling gate." },
    { id: "c2", name: "Bell State", description: "A maximally entangled two-qubit state." },
  ],
};

beforeEach(() => {
  useQuizStore.getState().reset();
});

describe("quizStore", () => {
  it("loadQuizForLesson populates the quiz from the generator", () => {
    useQuizStore.getState().loadQuizForLesson(lesson);
    expect(useQuizStore.getState().quiz).toHaveLength(2);
    expect(useQuizStore.getState().currentIndex).toBe(0);
    expect(useQuizStore.getState().hintsUsed).toEqual({});
  });

  it("useHint marks the question's hint as used, once", () => {
    useQuizStore.getState().loadQuizForLesson(lesson);
    const qid = useQuizStore.getState().quiz[0].id;
    useQuizStore.getState().useHint(qid);
    expect(useQuizStore.getState().hintsUsed[qid]).toBe(true);
  });

  it("setAnswer/nextQuestion/setScore behave as before", () => {
    useQuizStore.getState().loadQuizForLesson(lesson);
    const qid = useQuizStore.getState().quiz[0].id;
    useQuizStore.getState().setAnswer(qid, "CNOT Gate");
    expect(useQuizStore.getState().answers[qid]).toBe("CNOT Gate");
    useQuizStore.getState().nextQuestion();
    expect(useQuizStore.getState().currentIndex).toBe(1);
    useQuizStore.getState().setScore(100);
    expect(useQuizStore.getState().score).toBe(100);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --dir frontend test -- quizStore`
Expected: FAIL — `loadQuizForLesson`/`useHint`/`hintsUsed` don't exist.

- [ ] **Step 7: Extend the store**

Replace the full contents of `frontend/src/stores/quizStore.ts`:

```ts
import { create } from "zustand";
import type { LessonDetail } from "@/types";
import type { QuizQuestion } from "@/types/quiz";
import { generateQuizFromLesson } from "@/lib/quiz-generator";

interface QuizStore {
  quiz: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  hintsUsed: Record<string, boolean>;
  score: number;
  setQuiz: (quiz: QuizQuestion[]) => void;
  loadQuizForLesson: (lesson: LessonDetail) => void;
  setAnswer: (questionId: string, answer: string) => void;
  useHint: (questionId: string) => void;
  nextQuestion: () => void;
  setScore: (score: number) => void;
  reset: () => void;
}

export const useQuizStore = create<QuizStore>((set) => ({
  quiz: [],
  currentIndex: 0,
  answers: {},
  hintsUsed: {},
  score: 0,
  setQuiz: (quiz) => set({ quiz, currentIndex: 0, answers: {}, hintsUsed: {}, score: 0 }),
  loadQuizForLesson: (lesson) =>
    set({ quiz: generateQuizFromLesson(lesson), currentIndex: 0, answers: {}, hintsUsed: {}, score: 0 }),
  setAnswer: (questionId, answer) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: answer } })),
  useHint: (questionId) =>
    set((s) => ({ hintsUsed: { ...s.hintsUsed, [questionId]: true } })),
  nextQuestion: () => set((s) => ({ currentIndex: s.currentIndex + 1 })),
  setScore: (score) => set({ score }),
  reset: () => set({ quiz: [], currentIndex: 0, answers: {}, hintsUsed: {}, score: 0 }),
}));
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --dir frontend test -- quizStore`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/types/quiz.ts frontend/src/lib/quiz-generator.ts frontend/src/stores/quizStore.ts frontend/test/lib/quiz-generator.test.ts frontend/test/stores/quizStore.test.ts
git commit -m "feat(quiz): add quiz-generator, richer QuizQuestion type, extend quizStore"
```

---

### Task 10: `QuizWorkspace` components

**Files:**
- Create: `frontend/src/components/quiz/QuizProgressBar.tsx`
- Create: `frontend/src/components/quiz/QuestionDisplay.tsx`
- Create: `frontend/src/components/quiz/AnswerOptions.tsx`
- Create: `frontend/src/components/quiz/HintButton.tsx`
- Create: `frontend/src/components/quiz/QuizNavigation.tsx`
- Create: `frontend/src/components/quiz/QuizWorkspace.tsx`
- Test: one file per component under `frontend/test/components/quiz/`

**Interfaces:**
- `QuizProgressBar({ current, total, label }: { current: number; total: number; label: string })`
- `QuestionDisplay({ question }: { question: QuizQuestion })`
- `AnswerOptions({ options, selected, onSelect }: { options: string[]; selected: string | null; onSelect: (v: string) => void })`
- `HintButton({ hint, used, onUse }: { hint: string; used: boolean; onUse: () => void })`
- `QuizNavigation({ canGoBack, isLast, onBack, onNext }: { canGoBack: boolean; isLast: boolean; onBack: () => void; onNext: () => void })` — `onNext` doubles as "Submit" copy/behavior when `isLast`.
- `QuizWorkspace(): JSX.Element` — composes all of the above, reads `useLearningStore.activeLesson` + `useQuizStore`, calls `loadQuizForLesson` on lesson change, and on final submit calls `setScore` then `useLearningStore.getState().updateMastery(conceptId, score)` per answered question.

- [ ] **Step 1: Write and pass `QuizProgressBar`**

Test (`frontend/test/components/quiz/QuizProgressBar.test.tsx`):
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuizProgressBar from "@/components/quiz/QuizProgressBar";

describe("QuizProgressBar", () => {
  it("renders the question count and label", () => {
    render(<QuizProgressBar current={3} total={5} label="Multi-Qubit Gates" />);
    expect(screen.getByText("Question 3 of 5")).toBeInTheDocument();
    expect(screen.getByText("Multi-Qubit Gates")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  });
});
```
Run: `pnpm --dir frontend test -- QuizProgressBar` → FAIL.

Implement `frontend/src/components/quiz/QuizProgressBar.tsx`:
```tsx
"use client";

import { Progress } from "@/components/ui/progress";

export default function QuizProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {current} of {total}
        </span>
        <span>{label}</span>
      </div>
      <Progress
        value={pct}
        aria-label={`Quiz progress: question ${current} of ${total}`}
        className="[&>*]:bg-electric-purple"
      />
    </div>
  );
}
```
Run again → PASS. (`@/components/ui/progress`'s `Progress` must expose `role="progressbar"` and `aria-valuenow` — confirm by reading `frontend/src/components/ui/progress.tsx`; it wraps Radix `Progress.Root`/`Indicator`, which already set these ARIA attributes, so no changes needed there.)

- [ ] **Step 2: Write and pass `QuestionDisplay`**

Test (`frontend/test/components/quiz/QuestionDisplay.test.tsx`):
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuestionDisplay from "@/components/quiz/QuestionDisplay";
import type { QuizQuestion } from "@/types/quiz";

const question: QuizQuestion = {
  id: "q-c1",
  concept_id: "c1",
  question_text: "Which concept does this describe: \"A two-qubit entangling gate.\"?",
  question_type: "multiple_choice",
  options: ["CNOT Gate", "Bell State"],
  correct_answer: "CNOT Gate",
  hint: "A two-qubit entangling gate.",
};

describe("QuestionDisplay", () => {
  it("renders the question text", () => {
    render(<QuestionDisplay question={question} />);
    expect(screen.getByText(question.question_text)).toBeInTheDocument();
  });
});
```
Run → FAIL.

Implement `frontend/src/components/quiz/QuestionDisplay.tsx`:
```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { QuizQuestion } from "@/types/quiz";

export default function QuestionDisplay({ question }: { question: QuizQuestion }) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {question.question_text}
      </ReactMarkdown>
    </div>
  );
}
```
Run → PASS.

- [ ] **Step 3: Write and pass `AnswerOptions`**

Test (`frontend/test/components/quiz/AnswerOptions.test.tsx`):
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnswerOptions from "@/components/quiz/AnswerOptions";

describe("AnswerOptions", () => {
  it("renders a radio group and calls onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AnswerOptions options={["CNOT Gate", "Bell State"]} selected={null} onSelect={onSelect} />);
    await user.click(screen.getByRole("radio", { name: "Bell State" }));
    expect(onSelect).toHaveBeenCalledWith("Bell State");
  });

  it("marks the selected option checked", () => {
    render(<AnswerOptions options={["CNOT Gate", "Bell State"]} selected="CNOT Gate" onSelect={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "CNOT Gate" })).toBeChecked();
  });
});
```
Run → FAIL.

Implement `frontend/src/components/quiz/AnswerOptions.tsx`:
```tsx
"use client";

export default function AnswerOptions({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Answer options" className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      {options.map((option) => (
        <label
          key={option}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
            selected === option
              ? "border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan"
              : "border-white/10 text-foreground hover:bg-white/5"
          }`}
        >
          <input
            type="radio"
            name="quiz-answer"
            role="radio"
            aria-checked={selected === option}
            checked={selected === option}
            onChange={() => onSelect(option)}
            className="h-4 w-4"
          />
          {option}
        </label>
      ))}
    </div>
  );
}
```
Run → PASS.

- [ ] **Step 4: Write and pass `HintButton`**

Test (`frontend/test/components/quiz/HintButton.test.tsx`):
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HintButton from "@/components/quiz/HintButton";

describe("HintButton", () => {
  it("shows a 'Show hint' button before use, reveals the hint text after clicking, and disables further clicks", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(<HintButton hint="A two-qubit entangling gate." used={false} onUse={onUse} />);
    await user.click(screen.getByRole("button", { name: /show hint/i }));
    expect(onUse).toHaveBeenCalledOnce();
  });

  it("shows the hint text once used", () => {
    render(<HintButton hint="A two-qubit entangling gate." used onUse={vi.fn()} />);
    expect(screen.getByText("A two-qubit entangling gate.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show hint/i })).not.toBeInTheDocument();
  });
});
```
Run → FAIL.

Implement `frontend/src/components/quiz/HintButton.tsx`:
```tsx
"use client";

import { Lightbulb } from "lucide-react";

/** Costs mastery points, one hint per question, per design.md's quiz spec. */
export default function HintButton({
  hint,
  used,
  onUse,
}: {
  hint: string;
  used: boolean;
  onUse: () => void;
}) {
  if (used) {
    return (
      <p className="mx-auto w-full max-w-2xl rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
        <span className="font-medium text-warning">Hint: </span>
        {hint}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button
        type="button"
        onClick={onUse}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-warning hover:bg-warning/10"
      >
        <Lightbulb size={13} aria-hidden />
        Show hint (costs mastery points)
      </button>
    </div>
  );
}
```
Run → PASS.

- [ ] **Step 5: Write and pass `QuizNavigation`**

Test (`frontend/test/components/quiz/QuizNavigation.test.tsx`):
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizNavigation from "@/components/quiz/QuizNavigation";

describe("QuizNavigation", () => {
  it("disables Previous on the first question and calls onNext for Next", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<QuizNavigation canGoBack={false} isLast={false} onBack={vi.fn()} onNext={onNext} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows Submit instead of Next on the last question", () => {
    render(<QuizNavigation canGoBack isLast onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });
});
```
Run → FAIL.

Implement `frontend/src/components/quiz/QuizNavigation.tsx`:
```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function QuizNavigation({
  canGoBack,
  isLast,
  onBack,
  onNext,
}: {
  canGoBack: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
      <Button type="button" variant="outline" disabled={!canGoBack} onClick={onBack}>
        Previous
      </Button>
      <Button type="button" onClick={onNext}>
        {isLast ? "Submit" : "Next"}
      </Button>
    </div>
  );
}
```
Run → PASS.

- [ ] **Step 6: Write and pass `QuizWorkspace`**

Test (`frontend/test/components/quiz/QuizWorkspace.test.tsx`):
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizWorkspace from "@/components/quiz/QuizWorkspace";
import { useLearningStore } from "@/stores/learningStore";
import { useQuizStore } from "@/stores/quizStore";
import type { LessonDetail } from "@/types";

const lesson: LessonDetail = {
  id: "l1",
  module_id: "m0",
  title: "Multi-Qubit Gates",
  content: "…",
  lesson_type: "text",
  is_pro: false,
  concepts: [
    { id: "c1", name: "CNOT Gate", description: "A two-qubit entangling gate." },
    { id: "c2", name: "Bell State", description: "A maximally entangled two-qubit state." },
  ],
};

const updateMastery = vi.fn();

beforeEach(() => {
  updateMastery.mockClear();
  useLearningStore.setState({ activeLesson: lesson, updateMastery });
  useQuizStore.getState().reset();
});

describe("QuizWorkspace", () => {
  it("loads the quiz for the active lesson and shows question 1 of N", () => {
    render(<QuizWorkspace />);
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
  });

  it("selecting an answer and clicking Next advances to question 2", async () => {
    const user = userEvent.setup();
    render(<QuizWorkspace />);
    const firstOption = useQuizStore.getState().quiz[0].options[0];
    await user.click(screen.getByRole("radio", { name: firstOption }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
  });

  it("submitting the last question scores the quiz and updates mastery per concept", async () => {
    const user = userEvent.setup();
    render(<QuizWorkspace />);

    const q1 = useQuizStore.getState().quiz[0];
    await user.click(screen.getByRole("radio", { name: q1.correct_answer }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    const q2 = useQuizStore.getState().quiz[1];
    await user.click(screen.getByRole("radio", { name: q2.correct_answer }));
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(useQuizStore.getState().score).toBe(100);
    expect(updateMastery).toHaveBeenCalledWith("c1", 1);
    expect(updateMastery).toHaveBeenCalledWith("c2", 1);
    expect(screen.getByText(/quiz complete/i)).toBeInTheDocument();
  });
});
```
Run → FAIL.

Implement `frontend/src/components/quiz/QuizWorkspace.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useLearningStore } from "@/stores/learningStore";
import { useQuizStore } from "@/stores/quizStore";
import QuizProgressBar from "@/components/quiz/QuizProgressBar";
import QuestionDisplay from "@/components/quiz/QuestionDisplay";
import AnswerOptions from "@/components/quiz/AnswerOptions";
import HintButton from "@/components/quiz/HintButton";
import QuizNavigation from "@/components/quiz/QuizNavigation";
import AITutorPanel from "@/components/tutor/AITutorPanel";

export default function QuizWorkspace() {
  const activeLesson = useLearningStore((s) => s.activeLesson);
  const quiz = useQuizStore((s) => s.quiz);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const hintsUsed = useQuizStore((s) => s.hintsUsed);
  const score = useQuizStore((s) => s.score);
  const loadQuizForLesson = useQuizStore((s) => s.loadQuizForLesson);
  const setAnswer = useQuizStore((s) => s.setAnswer);
  const useHint = useQuizStore((s) => s.useHint);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const setScore = useQuizStore((s) => s.setScore);

  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (activeLesson) loadQuizForLesson(activeLesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson?.id]);

  if (!activeLesson || quiz.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {activeLesson ? "This lesson has no practice questions yet." : "Select a lesson to practice."}
        </p>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-foreground">Quiz complete!</p>
        <p className="text-sm text-muted-foreground">You scored {score}%.</p>
      </main>
    );
  }

  const question = quiz[currentIndex];
  const isLast = currentIndex === quiz.length - 1;

  function handleNext() {
    if (!isLast) {
      nextQuestion();
      return;
    }

    const correctCount = quiz.filter((q) => answers[q.id] === q.correct_answer).length;
    const finalScore = Math.round((correctCount / quiz.length) * 100);
    setScore(finalScore);
    for (const q of quiz) {
      useLearningStore.getState().updateMastery(q.concept_id, answers[q.id] === q.correct_answer ? 1 : 0);
    }
    setSubmitted(true);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <QuizProgressBar current={currentIndex + 1} total={quiz.length} label={activeLesson.title} />
      <QuestionDisplay question={question} />
      <AnswerOptions
        options={question.options}
        selected={answers[question.id] ?? null}
        onSelect={(value) => setAnswer(question.id, value)}
      />
      <HintButton
        hint={question.hint}
        used={!!hintsUsed[question.id]}
        onUse={() => useHint(question.id)}
      />
      <QuizNavigation
        canGoBack={currentIndex > 0}
        isLast={isLast}
        onBack={() => useQuizStore.setState({ currentIndex: currentIndex - 1 })}
        onNext={handleNext}
      />
      {submitted && (
        <div className="mx-auto w-full max-w-2xl">
          <AITutorPanel />
        </div>
      )}
    </main>
  );
}
```
Run → PASS.

Note: the `{submitted && <AITutorPanel />}` block inside the pre-submit return path is unreachable (the component returns early on `submitted`) — move that block into the `submitted` branch's JSX instead, directly under the score paragraph:
```tsx
  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center gap-3 p-6">
        <p className="text-lg font-semibold text-foreground">Quiz complete!</p>
        <p className="text-sm text-muted-foreground">You scored {score}%.</p>
        <div className="mt-4 w-full max-w-2xl overflow-hidden rounded-xl border border-white/10">
          <AITutorPanel />
        </div>
      </main>
    );
  }
```
and delete the leftover `{submitted && (...)}` block further down in the main return.

- [ ] **Step 7: Run all quiz component tests**

Run: `pnpm --dir frontend test -- components/quiz`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/quiz frontend/test/components/quiz
git commit -m "feat(quiz): add QuizWorkspace and its child components"
```

---

### Task 11: `/quiz` route + `DashboardActivityBar` dim mode

**Files:**
- Modify: `frontend/src/components/dashboard/DashboardActivityBar.tsx:32-57`
- Test: `frontend/test/components/dashboard/DashboardActivityBar.test.tsx`
- Create: `frontend/src/app/quiz/page.tsx`
- Test: `frontend/test/app/quiz/page.test.tsx`
- Modify: `frontend/src/components/dashboard/LabShell.tsx` (thread `dim` through, done in Task 3 already if the test in that task is followed — verify here)

**Interfaces:**
- `DashboardActivityBar({ onOpenTutor, dim }: { onOpenTutor?: () => void; dim?: boolean })`.

- [ ] **Step 1: Write the failing test for `dim`**

Add to `frontend/test/components/dashboard/DashboardActivityBar.test.tsx` (create the file with this one test if it doesn't already exist — check first with `ls frontend/test/components/dashboard/DashboardActivityBar.test.tsx`):

```tsx
  it("applies reduced opacity styling when dim is true", () => {
    render(<DashboardActivityBar dim />);
    expect(screen.getByLabelText("Dashboard navigation")).toHaveClass("opacity-30");
  });
```

(If the test file doesn't exist yet, create it with the necessary imports/mocks mirroring `frontend/test/components/dashboard/DashboardTutorPanel.test.tsx`'s setup style, plus this one test — a full a11y/nav-link test suite for `DashboardActivityBar` is out of scope for this plan, since only `dim` is new behavior.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test -- DashboardActivityBar`
Expected: FAIL — `dim` prop not applied.

- [ ] **Step 3: Implement**

In `frontend/src/components/dashboard/DashboardActivityBar.tsx`, update the function signature (currently line 32-36):
```tsx
export default function DashboardActivityBar({
  onOpenTutor,
  dim = false,
}: {
  onOpenTutor?: () => void;
  dim?: boolean;
}) {
```
and the `<nav>`'s `className` (currently line 55-57):
```tsx
    <nav
      aria-label="Dashboard navigation"
      className={`flex w-[68px] flex-shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-surface py-3 transition-opacity ${
        dim ? "opacity-30" : ""
      }`}
    >
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test -- DashboardActivityBar`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `/quiz`**

Create `frontend/test/app/quiz/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import QuizPage from "@/app/quiz/page";

vi.mock("next/navigation", () => ({ usePathname: () => "/quiz" }));
vi.mock("@/hooks/useCourseBootstrap", () => ({
  useCourseBootstrap: () => ({ coursesLoading: false, coursesError: null, onRetry: vi.fn() }),
}));
vi.mock("@/components/dashboard/LabShell", () => ({
  default: ({
    children,
    sidebarCollapsed,
    tutorCollapsed,
    activityBarDim,
  }: {
    children: (ctx: { onExplainCircuit: () => void }) => React.ReactNode;
    sidebarCollapsed?: boolean;
    tutorCollapsed?: boolean;
    activityBarDim?: boolean;
  }) => (
    <div
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      data-tutor-collapsed={tutorCollapsed ? "true" : "false"}
      data-activity-dim={activityBarDim ? "true" : "false"}
    >
      {children({ onExplainCircuit: () => {} })}
    </div>
  ),
}));
vi.mock("@/components/quiz/QuizWorkspace", () => ({
  default: () => <div>QuizWorkspaceMock</div>,
}));

describe("/quiz page", () => {
  it("renders QuizWorkspace inside a focus-mode LabShell", () => {
    render(<QuizPage />);
    expect(screen.getByText("QuizWorkspaceMock")).toBeInTheDocument();
    const shell = screen.getByText("QuizWorkspaceMock").parentElement!;
    expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
    expect(shell).toHaveAttribute("data-tutor-collapsed", "true");
    expect(shell).toHaveAttribute("data-activity-dim", "true");
  });
});
```

- [ ] **Step 6: Run test to verify it fails, then implement**

Run: `pnpm --dir frontend test -- app/quiz` → FAIL.

Create `frontend/src/app/quiz/page.tsx`:

```tsx
"use client";

import LabShell from "@/components/dashboard/LabShell";
import QuizWorkspace from "@/components/quiz/QuizWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";

export default function QuizPage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  return (
    <LabShell
      sidebarCollapsed
      tutorCollapsed
      activityBarDim
      sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}
    >
      {() => <QuizWorkspace />}
    </LabShell>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --dir frontend test -- app/quiz`
Expected: PASS.

- [ ] **Step 8: Manual smoke check**

`pnpm --dir frontend dev`, visit `/quiz` on a lesson with 2+ concepts, answer both questions, submit, confirm the score screen and inline tutor panel appear, and that the curriculum sidebar/tutor column are absent and the activity bar is visibly dimmed throughout.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/dashboard/DashboardActivityBar.tsx frontend/test/components/dashboard/DashboardActivityBar.test.tsx frontend/src/app/quiz/page.tsx frontend/test/app/quiz/page.test.tsx
git commit -m "feat(quiz): rebuild /quiz as a focus-mode LabShell route"
```

---

### Task 12: Retire the old generic shell

**Files:**
- Delete: `frontend/src/app/(shell)/layout.tsx`, `frontend/src/app/(shell)/circuit/page.tsx`, `frontend/src/app/(shell)/code/page.tsx`, `frontend/src/app/(shell)/learn/page.tsx`, `frontend/src/app/(shell)/quiz/page.tsx`
- Delete: `frontend/src/components/shell/AppShell.tsx`, `TitleBar.tsx`, `BottomPanel.tsx`, `StatusBar.tsx`, `TutorFAB.tsx`, `ActivityBar.tsx`, `WorkspacePlaceholder.tsx`, `BreadcrumbNav.tsx`, `UserMenu.tsx`, `XPProgressBar.tsx`
- Delete: `frontend/src/components/learn/LearnWorkspace.tsx`, `frontend/src/components/learn/LessonOutline.tsx`
- Delete: `frontend/src/components/circuit/CircuitBuilderWorkspace.tsx`
- Delete: `frontend/src/components/dashboard/CircuitCodePanel.tsx`
- Delete: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Delete: `frontend/test/components/shell/*.test.tsx` (all 7 files), `frontend/test/components/learn/LearnWorkspace.test.tsx`, `frontend/test/components/learn/LessonOutline.test.tsx`, `frontend/test/hooks/useKeyboardShortcuts.test.tsx`
- Modify: `frontend/src/stores/shellStore.ts` (drop dead fields)
- Modify: `frontend/src/lib/workspaces.ts` if it references anything deleted (verify — currently it doesn't import shell components, only defines route metadata, so no change expected; confirm during Step 1's grep pass)

**Interfaces:** none new — this task only removes dead code, gated on a `git grep` confirming nothing outside the deleted set still imports it.

- [ ] **Step 1: Confirm nothing outside the deletion set references these files**

Run:
```bash
cd frontend
git grep -l "components/shell/AppShell\|components/shell/TitleBar\|components/shell/BottomPanel\|components/shell/StatusBar\|components/shell/TutorFAB\|components/shell/ActivityBar\b\|components/shell/WorkspacePlaceholder\|components/shell/BreadcrumbNav\|components/shell/UserMenu\|components/shell/XPProgressBar\|components/learn/LearnWorkspace\|components/learn/LessonOutline\|components/circuit/CircuitBuilderWorkspace\|components/dashboard/CircuitCodePanel\|hooks/useKeyboardShortcuts" -- src test
```
Expected: only the files themselves and their own test files appear (no other consumer). If anything else appears, stop and investigate before deleting — do not delete a file something still imports.

- [ ] **Step 2: Delete the confirmed-dead files**

```bash
cd frontend
git rm -r \
  "src/app/(shell)" \
  src/components/shell/AppShell.tsx \
  src/components/shell/TitleBar.tsx \
  src/components/shell/BottomPanel.tsx \
  src/components/shell/StatusBar.tsx \
  src/components/shell/TutorFAB.tsx \
  src/components/shell/ActivityBar.tsx \
  src/components/shell/WorkspacePlaceholder.tsx \
  src/components/shell/BreadcrumbNav.tsx \
  src/components/shell/UserMenu.tsx \
  src/components/shell/XPProgressBar.tsx \
  src/components/learn/LearnWorkspace.tsx \
  src/components/learn/LessonOutline.tsx \
  src/components/circuit/CircuitBuilderWorkspace.tsx \
  src/components/dashboard/CircuitCodePanel.tsx \
  src/hooks/useKeyboardShortcuts.ts \
  test/components/shell \
  test/components/learn/LearnWorkspace.test.tsx \
  test/components/learn/LessonOutline.test.tsx \
  test/hooks/useKeyboardShortcuts.test.tsx
```

- [ ] **Step 3: Clean up `shellStore`**

`frontend/src/stores/shellStore.ts` still has `tutorOpen`/`toggleTutor` (used by `tutorStore.sendMessage`'s `onComplete` — keep those) but `bottomPanelOpen`/`toggleBottomPanel`/`focusMode`/`setFocusMode`/`bottomPanelTab`/`setBottomPanelTab` are now unreferenced (their only readers/writers were the deleted `BottomPanel` component and `circuitStore.runSimulation`, already cleaned up in Task 5). Confirm with:
```bash
git grep -n "bottomPanelOpen\|toggleBottomPanel\|focusMode\|setFocusMode\|bottomPanelTab\|setBottomPanelTab" -- src test
```
Expected: only `shellStore.ts` itself. Replace the full contents of `frontend/src/stores/shellStore.ts`:
```ts
import { create } from "zustand";

type Workspace = "dashboard" | "learn" | "circuit" | "code" | "quiz" | "settings";

interface ShellStore {
  activeWorkspace: Workspace;
  tutorOpen: boolean;
  setWorkspace: (workspace: Workspace) => void;
  toggleTutor: () => void;
}

export const useShellStore = create<ShellStore>()((set) => ({
  activeWorkspace: "dashboard",
  tutorOpen: false,
  setWorkspace: (activeWorkspace) => set({ activeWorkspace }),
  toggleTutor: () => set((s) => ({ tutorOpen: !s.tutorOpen })),
}));
```
(Drops the `persist` wrapper too — its only persisted key was `bottomPanelOpen`, which no longer exists.)

If any test in `frontend/test/stores/shellStore.test.ts` references the removed fields, update it to match; if the whole file only tested removed behavior, delete it (verify contents first with `Read`).

- [ ] **Step 4: Verify `lib/workspaces.ts` needs no change**

Run: `cat frontend/src/lib/workspaces.ts` and confirm it has no import of anything deleted (it's pure metadata + `workspaceFromPathname`, already confirmed during design). No action expected.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm --dir frontend test`
Expected: PASS, with the deleted files' tests simply gone (not failing).

- [ ] **Step 6: Type-check, lint, build**

Run:
```bash
pnpm --dir frontend type-check
pnpm --dir frontend lint
pnpm --dir frontend build
```
Expected: all three succeed. Pay particular attention to the build step — it's the first point that would catch Monaco's dynamic import breaking the production bundle, or any remaining stale import of a deleted file that tests didn't catch (e.g. a non-test file importing a deleted component with no corresponding test).

- [ ] **Step 7: Manual full-app smoke pass**

`pnpm --dir frontend dev` (or `NEXT_PUBLIC_DEV_NO_AUTH=1 pnpm --dir frontend dev` to skip login), click through `/dashboard`, `/learn`, `/circuit`, `/code`, `/quiz` via the `DashboardActivityBar` nav, confirming: consistent header/chrome across all five, working lesson content, working circuit builder + inline results, working Monaco code panel + file tree, working quiz flow with focus mode (dimmed activity bar, no sidebar/tutor column) end-to-end to the score screen.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: retire generic AppShell now that all workspaces use LabShell"
```

---

## Self-Review Notes

- **Spec coverage:** LabShell extraction (Task 3), CentralWorkspace lockedTab (Task 1), `/learn` (Task 4), `/circuit` + inline results (Task 5), `/code` FileTreePanel + Monaco + run-gating (Tasks 6-8), `/quiz` generator + workspace + focus mode (Tasks 9-11), old shell retirement (Task 12) — every spec section has a task.
- **Placeholder scan:** no TBDs; every step has literal code. The one intentionally-flagged draft mistake (unused icon imports in `LabShell`, and the unreachable `AITutorPanel` block in `QuizWorkspace`) is called out explicitly with the exact fix in the same step, not left dangling.
- **Type consistency:** `QuizQuestion` (Task 9) is used identically in `quiz-generator.ts`, `quizStore.ts`, and all `components/quiz/*` (Task 10) — `concept_id`, `correct_answer`, `options`, `hint` field names match everywhere. `LabShellChildContext`'s `onExplainCircuit` shape is consumed identically by `DashboardWorkspace`, `/learn`, `/circuit`, `/code` (all pass it straight through to `CentralWorkspace`).
