import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GateLibrary from "@/components/circuit/library/GateLibrary";
import { useCircuitStore } from "@/stores/circuitStore";

const gate = (type: string) => document.querySelector(`[data-gate="${type}"]`);

beforeEach(() => {
  useCircuitStore.getState().reset();
});

describe("GateLibrary", () => {
  it("renders the header, search and category tabs", () => {
    render(<GateLibrary />);
    expect(screen.getByRole("heading", { name: "Quantum Gates" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search gates" })).toBeInTheDocument();
    for (const name of ["Single Qubit", "Multi Qubit", "Measurement"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("shows every single-qubit gate on the default tab", () => {
    render(<GateLibrary />);
    for (const g of ["H", "X", "Y", "Z", "S", "T", "I", "RX", "RY", "RZ", "U", "P"]) {
      expect(gate(g)).not.toBeNull();
    }
    expect(gate("CX")).toBeNull();
  });

  it("lists advanced gates under More Gates and can collapse them", async () => {
    const user = userEvent.setup();
    render(<GateLibrary />);
    for (const g of ["SX", "RXX", "RYY", "RZZ", "U3"]) expect(gate(g)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "More Gates" }));
    expect(gate("U3")).toBeNull();
  });

  it("switches to the multi-qubit and measurement tabs", async () => {
    const user = userEvent.setup();
    render(<GateLibrary />);
    await user.click(screen.getByRole("tab", { name: "Multi Qubit" }));
    for (const g of ["CX", "CZ", "SWAP"]) expect(gate(g)).not.toBeNull();
    await user.click(screen.getByRole("tab", { name: "Measurement" }));
    expect(gate("M")).not.toBeNull();
  });

  it("search filters across categories by name and description", async () => {
    const user = userEvent.setup();
    render(<GateLibrary />);
    await user.type(screen.getByRole("searchbox"), "cnot");
    expect(gate("CX")).not.toBeNull();
    expect(gate("H")).toBeNull();
    expect(screen.getByText(/1 match/)).toBeInTheDocument();
  });

  it("shows an empty message when nothing matches", async () => {
    const user = userEvent.setup();
    render(<GateLibrary />);
    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText(/No gates match/)).toBeInTheDocument();
  });
});
