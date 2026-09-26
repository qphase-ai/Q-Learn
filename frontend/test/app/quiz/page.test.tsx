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
