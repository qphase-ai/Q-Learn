import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GatePalette from "@/components/circuit/GatePalette";
import { useCircuitStore } from "@/stores/circuitStore";

vi.mock("@xyflow/react", () => ({
  ReactFlow: () => null,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  Background: () => null,
  Controls: () => null,
  applyNodeChanges: vi.fn((changes: unknown[], nodes: unknown[]) => nodes),
  applyEdgeChanges: vi.fn((changes: unknown[], edges: unknown[]) => edges),
  useReactFlow: () => ({ screenToFlowPosition: (p: { x: number; y: number }) => p }),
}));

beforeEach(() => {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({
    circuitName: "Untitled",
    qubitCount: 2,
    selectedGateType: null,
    error: null,
  });
});

describe("GatePalette", () => {
  it("renders all single-qubit gates", () => {
    render(<GatePalette />);
    for (const g of ["H", "X", "Y", "Z", "S", "T", "I"]) {
      expect(screen.getByText(g)).toBeInTheDocument();
    }
  });

  it("renders all two-qubit gates", () => {
    render(<GatePalette />);
    for (const g of ["CX", "CZ", "SWAP"]) {
      expect(screen.getByText(g)).toBeInTheDocument();
    }
  });

  it("renders the measurement gate", () => {
    render(<GatePalette />);
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows the three group headings", () => {
    render(<GatePalette />);
    expect(screen.getByText(/single/i)).toBeInTheDocument();
    expect(screen.getByText(/two.?qubit/i)).toBeInTheDocument();
    expect(screen.getByText(/measure/i)).toBeInTheDocument();
  });

  it("clicking a gate sets selectedGateType in the store", async () => {
    const user = userEvent.setup();
    render(<GatePalette />);
    await user.click(screen.getByText("H"));
    expect(useCircuitStore.getState().selectedGateType).toBe("H");
  });

  it("clicking a two-qubit gate sets selectedGateType to that gate", async () => {
    const user = userEvent.setup();
    render(<GatePalette />);
    await user.click(screen.getByText("CX"));
    expect(useCircuitStore.getState().selectedGateType).toBe("CX");
  });

  it("clicking M sets selectedGateType to M", async () => {
    const user = userEvent.setup();
    render(<GatePalette />);
    await user.click(screen.getByText("M"));
    expect(useCircuitStore.getState().selectedGateType).toBe("M");
  });
});
