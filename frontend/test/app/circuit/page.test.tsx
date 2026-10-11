import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CircuitPage from "@/app/circuit/page";
import { stashCircuitForBuilder } from "@/lib/circuit-handoff";
import { useCircuitStore } from "@/stores/circuitStore";

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
  default: ({ lockedTab, standaloneSandbox }: { lockedTab?: string; standaloneSandbox?: boolean }) => (
    <div>
      CentralWorkspace:{lockedTab}
      {standaloneSandbox ? ":standalone" : ""}
    </div>
  ),
}));

describe("/circuit page", () => {
  beforeEach(() => {
    useCircuitStore.setState({ nodes: [], qubitCount: 2, circuitName: "Untitled Circuit" });
    window.sessionStorage.clear();
  });

  it("renders CentralWorkspace locked to the circuit tab", () => {
    render(<CircuitPage />);
    expect(screen.getByText("CentralWorkspace:circuit")).toBeInTheDocument();
  });

  it("loads a circuit handed off from the AI Classroom on mount, as a standalone sandbox", async () => {
    stashCircuitForBuilder({
      qubits: 2,
      gates: [{ type: "H", targets: [0] }, { type: "CX", targets: [1], control: 0 }],
      name: "Bell state",
    });
    render(<CircuitPage />);
    expect(screen.getByText("CentralWorkspace:circuit:standalone")).toBeInTheDocument();
    await waitFor(() => expect(useCircuitStore.getState().nodes).toHaveLength(2));
    expect(useCircuitStore.getState().qubitCount).toBe(2);
    expect(useCircuitStore.getState().circuitName).toBe("Bell state");
    // One-shot: the stash is consumed, so a remount with nothing new stashed stays empty
    // and is not treated as a standalone sandbox.
    useCircuitStore.setState({ nodes: [], qubitCount: 2, circuitName: "Untitled Circuit" });
    render(<CircuitPage />);
    await new Promise((r) => setTimeout(r, 0));
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
    expect(screen.getAllByText("CentralWorkspace:circuit")[0]).toBeInTheDocument();
  });
});
