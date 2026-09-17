import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import QASMViewer from "@/components/visualization/QASMViewer";
import { useCircuitStore } from "@/stores/circuitStore";
import type { SimulationResult } from "@/types";

const baseResult: SimulationResult = {
  status: "completed",
  probabilities: null,
  measurements: null,
  statevector: null,
  qasm: null,
  execution_time_ms: 10,
};

beforeEach(() => {
  useCircuitStore.setState({ results: null });
});

describe("QASMViewer", () => {
  it("shows empty-state when results are null", () => {
    render(<QASMViewer />);
    expect(screen.getByText(/run a circuit/i)).toBeInTheDocument();
  });

  it("shows empty-state when qasm is null", () => {
    useCircuitStore.setState({ results: { ...baseResult, qasm: null } });
    render(<QASMViewer />);
    expect(screen.getByText(/run a circuit/i)).toBeInTheDocument();
  });

  it("renders the QASM text when present", () => {
    const qasmText = "OPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[2];\nh q[0];";
    useCircuitStore.setState({
      results: { ...baseResult, qasm: qasmText },
    });
    render(<QASMViewer />);
    // Use a function matcher because RTL normalises whitespace in getByText
    expect(
      screen.getByText((_, el) => el?.tagName === "PRE" && el.textContent === qasmText)
    ).toBeInTheDocument();
  });

  it("has a Copy button when qasm is present", () => {
    useCircuitStore.setState({
      results: { ...baseResult, qasm: "OPENQASM 2.0;" },
    });
    render(<QASMViewer />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });
});
