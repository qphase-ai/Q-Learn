import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import StateVectorTable from "@/components/visualization/StateVectorTable";
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

describe("StateVectorTable", () => {
  it("shows empty-state when results are null", () => {
    render(<StateVectorTable />);
    expect(screen.getByText(/run a circuit/i)).toBeInTheDocument();
  });

  it("renders amplitude 0.707 and phase 0° for |00⟩ from statevector [[0.707,0],[0,0],[0,0],[0.707,0]]", () => {
    useCircuitStore.setState({
      results: {
        ...baseResult,
        statevector: [
          [0.707, 0],
          [0, 0],
          [0, 0],
          [0.707, 0],
        ],
      },
    });
    render(<StateVectorTable />);

    // |00⟩ label
    expect(screen.getByText("|00⟩")).toBeInTheDocument();
    // amplitude 0.707 appears (at least once — |00⟩ and |11⟩ both have it)
    const amplitudes = screen.getAllByText("0.707");
    expect(amplitudes.length).toBeGreaterThanOrEqual(1);
    // phase 0° appears
    const zeroPhases = screen.getAllByText("0°");
    expect(zeroPhases.length).toBeGreaterThanOrEqual(1);
  });

  it("shows — for phase when amplitude is ~0", () => {
    useCircuitStore.setState({
      results: {
        ...baseResult,
        statevector: [
          [0.707, 0],
          [0, 0],   // |01⟩ has amplitude ~0
          [0, 0],   // |10⟩ has amplitude ~0
          [0.707, 0],
        ],
      },
    });
    render(<StateVectorTable />);
    // The zero-amplitude rows should show — for phase
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to sqrt(prob) amplitude and — phase when statevector is null but probabilities present", () => {
    useCircuitStore.setState({
      results: {
        ...baseResult,
        statevector: null,
        probabilities: { "00": 0.5, "11": 0.5 },
      },
    });
    render(<StateVectorTable />);

    // sqrt(0.5) ≈ 0.707 to 3 decimals
    const amplitudes = screen.getAllByText("0.707");
    expect(amplitudes.length).toBeGreaterThanOrEqual(1);

    // Phase column shows — in fallback mode
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);

    // Labels from probabilities
    expect(screen.getByText("|00⟩")).toBeInTheDocument();
    expect(screen.getByText("|11⟩")).toBeInTheDocument();
  });
});
