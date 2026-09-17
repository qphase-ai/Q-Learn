import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ConsoleOutput from "@/components/visualization/ConsoleOutput";
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

describe("ConsoleOutput", () => {
  it("shows empty-state when results are null", () => {
    render(<ConsoleOutput />);
    expect(screen.getByText(/run a circuit/i)).toBeInTheDocument();
  });

  it("shows error_message in error color when present", () => {
    useCircuitStore.setState({
      results: { ...baseResult, error_message: "boom" },
    });
    render(<ConsoleOutput />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows the status string when no error_message", () => {
    useCircuitStore.setState({
      results: { ...baseResult, status: "completed" },
    });
    render(<ConsoleOutput />);
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });
});
