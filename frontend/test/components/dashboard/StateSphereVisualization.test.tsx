import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StateSphereVisualization from "@/components/dashboard/StateSphereVisualization";
import { useCircuitStore } from "@/stores/circuitStore";

beforeEach(() => {
  useCircuitStore.setState({ results: null });
});

describe("StateSphereVisualization", () => {
  it("shows a placeholder sphere with no legend when there are no results", () => {
    render(<StateSphereVisualization />);
    expect(screen.getByRole("img", { name: /illustrative quantum state sphere/i })).toBeInTheDocument();
    expect(screen.getByText(/run a simulation/i)).toBeInTheDocument();
  });

  it("renders a legend chip per basis state above the probability threshold", () => {
    useCircuitStore.setState({
      results: {
        status: "completed",
        probabilities: { "00": 0, "01": 0, "10": 0.5, "11": 0.5 },
        measurements: null,
        statevector: null,
        execution_time_ms: 10,
      },
    });
    render(<StateSphereVisualization />);
    expect(screen.getByText(/\|10⟩ \(0\.50\)/)).toBeInTheDocument();
    expect(screen.getByText(/\|11⟩ \(0\.50\)/)).toBeInTheDocument();
    expect(screen.queryByText(/\|00⟩/)).not.toBeInTheDocument();
  });
});
