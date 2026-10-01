import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GateCard, { GATE_DRAG_MIME } from "@/components/circuit/library/GateCard";
import { useCircuitStore } from "@/stores/circuitStore";

beforeEach(() => {
  useCircuitStore.getState().reset();
});

describe("GateCard", () => {
  it("renders the gate symbol and name", () => {
    render(<GateCard type="H" />);
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("Hadamard")).toBeInTheDocument();
  });

  it("has a descriptive accessible label", () => {
    render(<GateCard type="CX" />);
    expect(screen.getByRole("button", { name: /CNOT gate \(two-qubit\)/ })).toBeInTheDocument();
  });

  it("shows the default angle for parametric gates", () => {
    render(<GateCard type="RX" />);
    expect(screen.getByText("π/2")).toBeInTheDocument();
  });

  it("clicking arms the gate, clicking again disarms it", async () => {
    const user = userEvent.setup();
    render(<GateCard type="X" />);
    const btn = screen.getByRole("button", { name: /Pauli-X gate/ });
    await user.click(btn);
    expect(useCircuitStore.getState().selectedGateType).toBe("X");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await user.click(btn);
    expect(useCircuitStore.getState().selectedGateType).toBeNull();
  });

  it("drag start sets the gate MIME data and the store's dragging gate; drag end clears it", () => {
    render(<GateCard type="Y" />);
    const btn = screen.getByRole("button", { name: /Pauli-Y gate/ });
    const setData = vi.fn();
    fireEvent.dragStart(btn, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith(GATE_DRAG_MIME, "Y");
    expect(useCircuitStore.getState().draggingGateType).toBe("Y");
    fireEvent.dragEnd(btn);
    expect(useCircuitStore.getState().draggingGateType).toBeNull();
  });
});
