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
