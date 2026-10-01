import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GateInspector, { parseAngle } from "@/components/circuit/GateInspector";
import { useCircuitStore } from "@/stores/circuitStore";

const data = () => useCircuitStore.getState().nodes[0].data as {
  qubit: number;
  control?: number;
  params?: { theta: number };
};

beforeEach(() => {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ qubitCount: 3 });
});

function selectFirst() {
  act(() => useCircuitStore.getState().selectGate(useCircuitStore.getState().nodes[0].id));
}

describe("parseAngle", () => {
  it("parses π expressions and plain numbers", () => {
    expect(parseAngle("π/4")).toBeCloseTo(Math.PI / 4);
    expect(parseAngle("-pi/2")).toBeCloseTo(-Math.PI / 2);
    expect(parseAngle("3π/4")).toBeCloseTo((3 * Math.PI) / 4);
    expect(parseAngle("0.5")).toBe(0.5);
    expect(parseAngle("2pi")).toBeCloseTo(2 * Math.PI);
    expect(parseAngle("abc")).toBeNull();
    expect(parseAngle("")).toBeNull();
  });
});

describe("GateInspector", () => {
  it("renders nothing without exactly one selected gate", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    render(<GateInspector />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("shows name, matrix, qubit, position and description of the selected gate", () => {
    useCircuitStore.getState().placeGate("H", 0, 2);
    selectFirst();
    render(<GateInspector />);
    expect(screen.getByRole("region", { name: "Gate inspector: Hadamard" })).toBeInTheDocument();
    expect(screen.getByText("Matrix")).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
    expect(screen.getByLabelText("Qubit")).toHaveValue("0");
    expect(screen.getByText("Column 3")).toBeInTheDocument();
    expect(screen.getByText(/equal superposition/)).toBeInTheDocument();
  });

  it("changes the qubit through the select", async () => {
    const user = userEvent.setup();
    useCircuitStore.getState().placeGate("X", 0, 0);
    selectFirst();
    render(<GateInspector />);
    await user.selectOptions(screen.getByLabelText("Qubit"), "2");
    expect(data().qubit).toBe(2);
  });

  it("edits a rotation angle via presets and free text", async () => {
    const user = userEvent.setup();
    useCircuitStore.getState().placeGate("RZ", 0, 0);
    selectFirst();
    render(<GateInspector />);
    await user.click(screen.getByRole("button", { name: "Set θ to π/4" }));
    expect(data().params?.theta).toBeCloseTo(Math.PI / 4);
    const input = screen.getByLabelText("θ");
    await user.clear(input);
    await user.type(input, "pi{Enter}");
    expect(data().params?.theta).toBeCloseTo(Math.PI);
  });

  it("shows control/target selects for controlled gates", () => {
    useCircuitStore.getState().placeTwoQubitGate("CX", 0, 1, 0);
    selectFirst();
    render(<GateInspector />);
    expect(screen.getByLabelText("Control")).toHaveValue("0");
    expect(screen.getByLabelText("Target")).toHaveValue("1");
  });

  it("duplicate, delete and explain actions", async () => {
    const user = userEvent.setup();
    const onExplain = vi.fn();
    useCircuitStore.getState().placeGate("H", 0, 0);
    selectFirst();
    render(<GateInspector onExplain={onExplain} />);
    await user.click(screen.getByRole("button", { name: /Ask the AI tutor/ }));
    expect(onExplain).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: /Duplicate gate/ }));
    expect(useCircuitStore.getState().nodes).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Delete gate/ }));
    expect(useCircuitStore.getState().nodes).toHaveLength(1);
  });
});
