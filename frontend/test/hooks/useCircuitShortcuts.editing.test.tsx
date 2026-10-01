import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { useCircuitShortcuts } from "@/hooks/useCircuitShortcuts";
import { useCircuitStore } from "@/stores/circuitStore";

function Harness() {
  useCircuitShortcuts();
  return <input id="circuit-gate-search" aria-label="search" />;
}

function press(key: string, opts?: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
}

const cells = () =>
  useCircuitStore.getState().nodes.map((n) => {
    const d = n.data as { type: string; qubit: number; column: number };
    return `${d.type}@${d.qubit}:${d.column}`;
  });

beforeEach(() => {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ qubitCount: 2 });
});

describe("useCircuitShortcuts — editing", () => {
  it("Ctrl+Z undoes and Ctrl+Shift+Z / Ctrl+Y redo", () => {
    render(<Harness />);
    useCircuitStore.getState().placeGate("H", 0, 0);
    press("z", { ctrlKey: true });
    expect(cells()).toEqual([]);
    press("z", { ctrlKey: true, shiftKey: true });
    expect(cells()).toEqual(["H@0:0"]);
    press("z", { metaKey: true });
    press("y", { ctrlKey: true });
    expect(cells()).toEqual(["H@0:0"]);
  });

  it("Ctrl+D duplicates and arrows move the selected gate", () => {
    render(<Harness />);
    useCircuitStore.getState().placeGate("X", 0, 0);
    useCircuitStore.getState().selectGate(useCircuitStore.getState().nodes[0].id);
    press("d", { ctrlKey: true });
    expect(cells()).toEqual(["X@0:0", "X@0:1"]);
    press("ArrowDown");
    press("ArrowRight");
    expect(cells()).toEqual(["X@0:0", "X@1:2"]);
  });

  it("Backspace deletes and Escape disarms then deselects", () => {
    render(<Harness />);
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().selectGate(useCircuitStore.getState().nodes[0].id);
    useCircuitStore.getState().setSelectedGateType("X");
    press("Escape");
    expect(useCircuitStore.getState().selectedGateType).toBeNull();
    expect(useCircuitStore.getState().nodes[0].selected).toBe(true);
    press("Escape");
    expect(useCircuitStore.getState().nodes[0].selected).toBe(false);
    useCircuitStore.getState().selectGate(useCircuitStore.getState().nodes[0].id);
    press("Backspace");
    expect(cells()).toEqual([]);
  });

  it("/ focuses the gate search", () => {
    const { getByLabelText } = render(<Harness />);
    press("/");
    expect(document.activeElement).toBe(getByLabelText("search"));
  });

  it("Space does not start a second run while one is active", () => {
    const runSimulation = vi.fn();
    useCircuitStore.setState({ runSimulation, runState: "running" } as never);
    render(<Harness />);
    press(" ");
    expect(runSimulation).not.toHaveBeenCalled();
    useCircuitStore.setState({ runState: "idle" });
    press(" ");
    expect(runSimulation).toHaveBeenCalledOnce();
  });
});
