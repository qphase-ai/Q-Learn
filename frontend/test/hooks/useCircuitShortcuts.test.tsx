import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useCircuitShortcuts } from "@/hooks/useCircuitShortcuts";
import { useCircuitStore } from "@/stores/circuitStore";

function Harness() {
  useCircuitShortcuts();
  return null;
}

const runSimulation = vi.fn();
const removeSelected = vi.fn();
const setSelectedGateType = vi.fn();

beforeEach(() => {
  runSimulation.mockClear();
  removeSelected.mockClear();
  setSelectedGateType.mockClear();
  useCircuitStore.setState({ runSimulation, removeSelected, setSelectedGateType } as never);
});

function press(key: string, opts?: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
}

describe("useCircuitShortcuts", () => {
  it("Space calls runSimulation", () => {
    render(<Harness />);
    press(" ");
    expect(runSimulation).toHaveBeenCalledTimes(1);
  });

  it("Delete calls removeSelected", () => {
    render(<Harness />);
    press("Delete");
    expect(removeSelected).toHaveBeenCalledTimes(1);
  });

  it("h calls setSelectedGateType('H')", () => {
    render(<Harness />);
    press("h");
    expect(setSelectedGateType).toHaveBeenCalledWith("H");
  });

  it("x calls setSelectedGateType('X')", () => {
    render(<Harness />);
    press("x");
    expect(setSelectedGateType).toHaveBeenCalledWith("X");
  });

  it("c calls setSelectedGateType('CX')", () => {
    render(<Harness />);
    press("c");
    expect(setSelectedGateType).toHaveBeenCalledWith("CX");
  });

  it("m calls setSelectedGateType('M')", () => {
    render(<Harness />);
    press("m");
    expect(setSelectedGateType).toHaveBeenCalledWith("M");
  });

  it("uppercase H also calls setSelectedGateType('H')", () => {
    render(<Harness />);
    press("H");
    expect(setSelectedGateType).toHaveBeenCalledWith("H");
  });

  it("does not fire when the event target is an input", () => {
    render(<Harness />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "h", bubbles: true }));
    expect(setSelectedGateType).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("does not fire when the event target is a textarea", () => {
    render(<Harness />);
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(runSimulation).not.toHaveBeenCalled();
    document.body.removeChild(ta);
  });

  it("does not fire with Ctrl modifier (Ctrl+h)", () => {
    render(<Harness />);
    press("h", { ctrlKey: true });
    expect(setSelectedGateType).not.toHaveBeenCalled();
  });

  it("does not fire with Meta modifier", () => {
    render(<Harness />);
    press("h", { metaKey: true });
    expect(setSelectedGateType).not.toHaveBeenCalled();
  });

  it("does not fire with Alt modifier", () => {
    render(<Harness />);
    press(" ", { altKey: true });
    expect(runSimulation).not.toHaveBeenCalled();
  });
});
