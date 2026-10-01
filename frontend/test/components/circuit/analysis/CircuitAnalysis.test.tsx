import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CircuitAnalysis from "@/components/circuit/analysis/CircuitAnalysis";
import { useCircuitStore } from "@/stores/circuitStore";
import type { SimulationResult } from "@/types";

const s = Math.SQRT1_2;
const BELL: SimulationResult = {
  status: "completed",
  probabilities: { "00": 0.5, "11": 0.5 },
  measurements: { "00": 512, "11": 512 },
  statevector: [[s, 0], [0, 0], [0, 0], [s, 0]],
  execution_time_ms: 42,
};

beforeEach(() => {
  useCircuitStore.getState().reset();
});

describe("CircuitAnalysis", () => {
  it("shows empty states before any run", () => {
    render(<CircuitAnalysis />);
    expect(screen.getByText(/amplitude of every basis state/)).toBeInTheDocument();
    expect(screen.getByText(/place each qubit on the sphere/)).toBeInTheDocument();
    expect(screen.getByText(/Add measurement \(M\) gates/)).toBeInTheDocument();
  });

  it("renders state vector, Bloch vector, bars and insight from results", () => {
    useCircuitStore.setState({ results: BELL, runState: "success" });
    render(<CircuitAnalysis />);
    const sv = screen.getByRole("region", { name: "State Vector" });
    expect(within(sv).getAllByText("0.7071 + 0.0000i")).toHaveLength(2);
    expect(within(sv).getByText(/0\.707\|00⟩ \+ 0\.707\|11⟩/)).toBeInTheDocument();
    expect(screen.getByText(/Mixed state/)).toBeInTheDocument();
    const meas = screen.getByRole("region", { name: "Measurement Results" });
    expect(within(meas).getAllByText("50.0%")).toHaveLength(2);
    expect(within(meas).getAllByText("0.0%")).toHaveLength(2);
    expect(screen.getByText(/1,024 shots sampled/)).toBeInTheDocument();
    expect(screen.getByText(/most likely outcomes/)).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toBeInTheDocument();
  });

  it("matches probability keys that contain register separators", () => {
    useCircuitStore.setState({
      results: {
        ...BELL,
        probabilities: { "0 1": 0.25, "1 0": 0.75 },
        measurements: { "0 1": 256, "1 0": 768 },
      },
      runState: "success",
    });
    render(<CircuitAnalysis />);
    const meas = screen.getByRole("region", { name: "Measurement Results" });
    expect(within(meas).getByText("25.0%")).toBeInTheDocument();
    expect(within(meas).getByText("75.0%")).toBeInTheDocument();
    expect(within(meas).getByTitle(/\|10⟩: 75.0% \(768 shots\)/)).toBeInTheDocument();
  });

  it("switches state-vector notation", async () => {
    const user = userEvent.setup();
    useCircuitStore.setState({ results: BELL, runState: "success" });
    render(<CircuitAnalysis />);
    await user.selectOptions(screen.getByLabelText("State vector notation"), "probability");
    expect(within(screen.getByRole("region", { name: "State Vector" })).getAllByText("50.0%")).toHaveLength(2);
  });

  it("shows a pure single-qubit vector without the mixed-state note", () => {
    useCircuitStore.setState({
      results: { ...BELL, statevector: [[s, 0], [s, 0]], probabilities: { "0": 0.5, "1": 0.5 } },
      runState: "success",
    });
    render(<CircuitAnalysis />);
    expect(screen.queryByText(/Mixed state/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Bloch vector x 1.00, y 0.00, z 0.00/ })).toBeInTheDocument();
  });

  it("the shots selector updates the store", async () => {
    const user = userEvent.setup();
    render(<CircuitAnalysis />);
    await user.selectOptions(screen.getByLabelText("Shots for the next run"), "4096");
    expect(useCircuitStore.getState().shots).toBe(4096);
  });

  it("shows run errors as an alert", () => {
    useCircuitStore.setState({ runState: "error", error: "Sandbox timeout" });
    render(<CircuitAnalysis />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sandbox timeout");
  });

  it("tracks the learning workflow", () => {
    render(<CircuitAnalysis />);
    expect(screen.getByText("Build").closest("[aria-current]")).toHaveAttribute("aria-current", "step");
  });
});
