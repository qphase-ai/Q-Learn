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
