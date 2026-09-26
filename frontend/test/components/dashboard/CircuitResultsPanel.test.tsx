import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CircuitResultsPanel from "@/components/dashboard/CircuitResultsPanel";
import { useCircuitStore } from "@/stores/circuitStore";

beforeEach(() => {
  useCircuitStore.setState({ runState: "idle", error: null, results: null });
});

describe("CircuitResultsPanel", () => {
  it("shows an error banner when the run failed", () => {
    useCircuitStore.setState({ runState: "error", error: "Backend unreachable" });
    render(<CircuitResultsPanel />);
    expect(screen.getByText("Backend unreachable")).toBeInTheDocument();
  });

  it("shows a completed status and key insight when results have two likely outcomes", () => {
    useCircuitStore.setState({
      runState: "success",
      results: {
        status: "completed",
        probabilities: { "00": 0.5, "11": 0.5 },
        measurements: null,
        statevector: null,
        execution_time_ms: 12,
      },
    });
    render(<CircuitResultsPanel />);
    expect(screen.getByText(/simulation completed/i)).toBeInTheDocument();
    expect(screen.getByText(/most likely outcomes/i)).toBeInTheDocument();
  });
});
