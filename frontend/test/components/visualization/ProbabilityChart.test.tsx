import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProbabilityChart from "@/components/visualization/ProbabilityChart";
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

describe("ProbabilityChart", () => {
  it("shows empty-state when results are null", () => {
    render(<ProbabilityChart />);
    expect(screen.getByText(/run a circuit/i)).toBeInTheDocument();
  });

  it("renders a row for each bitstring when probabilities are provided", () => {
    useCircuitStore.setState({
      results: {
        ...baseResult,
        probabilities: { "00": 0.5, "11": 0.5 },
      },
    });
    render(<ProbabilityChart />);
    expect(screen.getByText("|00⟩")).toBeInTheDocument();
    expect(screen.getByText("|11⟩")).toBeInTheDocument();
  });

  it("displays the percentage text for each entry", () => {
    useCircuitStore.setState({
      results: {
        ...baseResult,
        probabilities: { "00": 0.5, "11": 0.5 },
      },
    });
    render(<ProbabilityChart />);
    const fiftyPercents = screen.getAllByText("50%");
    expect(fiftyPercents).toHaveLength(2);
  });

  it("shows empty-state when probabilities is null even with a result", () => {
    useCircuitStore.setState({ results: { ...baseResult, probabilities: null } });
    render(<ProbabilityChart />);
    expect(screen.getByText(/run a circuit/i)).toBeInTheDocument();
  });
});
