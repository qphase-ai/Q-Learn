import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RightPanel from "@/components/shell/RightPanel";
import BottomPanel from "@/components/shell/BottomPanel";
import { useShellStore } from "@/stores/shellStore";
import { useCircuitStore } from "@/stores/circuitStore";

const SEEDED_RESULTS = {
  status: "completed",
  probabilities: { "00": 0.5, "11": 0.5 },
  measurements: {},
  statevector: [
    [0.707, 0],
    [0, 0],
    [0, 0],
    [0.707, 0],
  ] as [number, number][],
  qasm: "OPENQASM 2.0; test",
  execution_time_ms: 5,
  error_message: null,
};

beforeEach(() => {
  useShellStore.setState({
    rightPanelOpen: true,
    bottomPanelOpen: true,
    bottomPanelTab: "probabilities",
  });
  useCircuitStore.setState({ results: null });
});

describe("RightPanel", () => {
  it("renders its region when open", () => {
    render(<RightPanel />);
    expect(screen.getByRole("complementary", { name: /ai tutor/i })).toBeInTheDocument();
  });

  it("is hidden when closed", () => {
    useShellStore.setState({ rightPanelOpen: false });
    render(<RightPanel />);
    expect(screen.queryByRole("complementary", { name: /ai tutor/i })).not.toBeInTheDocument();
  });
});

describe("BottomPanel", () => {
  it("renders the four result tabs when open", () => {
    render(<BottomPanel />);
    expect(screen.getByRole("tab", { name: /probabilities/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /state vector/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /qasm/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /console/i })).toBeInTheDocument();
  });

  it("shows ProbabilityChart content on probabilities tab", () => {
    useCircuitStore.setState({ results: SEEDED_RESULTS });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "probabilities" });
    render(<BottomPanel />);
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
  });

  it("shows StateVectorTable content on statevector tab", () => {
    useCircuitStore.setState({ results: SEEDED_RESULTS });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "statevector" });
    render(<BottomPanel />);
    expect(screen.getAllByText("0.707").length).toBeGreaterThan(0);
  });

  it("shows QASM content on qasm tab", () => {
    useCircuitStore.setState({ results: SEEDED_RESULTS });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "qasm" });
    render(<BottomPanel />);
    expect(screen.getByText("OPENQASM 2.0; test")).toBeInTheDocument();
  });

  it("shows ConsoleOutput content on console tab with error_message", () => {
    useCircuitStore.setState({
      results: { ...SEEDED_RESULTS, error_message: "Simulation failed: timeout" },
    });
    useShellStore.setState({ bottomPanelOpen: true, bottomPanelTab: "console" });
    render(<BottomPanel />);
    expect(screen.getByText("Simulation failed: timeout")).toBeInTheDocument();
  });
});
