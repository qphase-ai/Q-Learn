import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DraggableGate from "@/components/circuit/DraggableGate";
import { useCircuitStore } from "@/stores/circuitStore";
import type { GateType } from "@/types";

// Mock @xyflow/react to avoid canvas issues in jsdom
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

describe("DraggableGate", () => {
  it("renders the gate symbol", () => {
    render(<DraggableGate type="H" />);
    expect(screen.getByText("H")).toBeInTheDocument();
  });

  it("renders each gate type with its symbol", () => {
    const gateTypes: GateType[] = ["H", "X", "Y", "Z", "S", "T", "I", "CX", "CZ", "SWAP", "M"];
    for (const type of gateTypes) {
      const { unmount } = render(<DraggableGate type={type} />);
      expect(screen.getByText(type)).toBeInTheDocument();
      unmount();
    }
  });

  it("clicking a gate calls setSelectedGateType with that type", async () => {
    const user = userEvent.setup();
    render(<DraggableGate type="H" />);
    await user.click(screen.getByText("H"));
    expect(useCircuitStore.getState().selectedGateType).toBe("H");
  });

  it("clicking a different gate updates selectedGateType", async () => {
    const user = userEvent.setup();
    render(<DraggableGate type="CX" />);
    await user.click(screen.getByText("CX"));
    expect(useCircuitStore.getState().selectedGateType).toBe("CX");
  });

  it("sets dataTransfer on dragStart", () => {
    render(<DraggableGate type="X" />);
    const button = screen.getByText("X").closest("[draggable]") ?? screen.getByText("X");
    const dataMap: Record<string, string> = {};
    const mockDataTransfer = {
      setData: (key: string, val: string) => { dataMap[key] = val; },
      effectAllowed: "",
    };
    fireEvent.dragStart(button, { dataTransfer: mockDataTransfer });
    expect(dataMap["application/gate-type"]).toBe("X");
  });

  it("has draggable attribute set to true", () => {
    render(<DraggableGate type="Z" />);
    // The outermost element should be draggable
    const el = screen.getByRole("button");
    expect(el).toHaveAttribute("draggable", "true");
  });
});
