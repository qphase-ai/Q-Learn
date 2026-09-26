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
