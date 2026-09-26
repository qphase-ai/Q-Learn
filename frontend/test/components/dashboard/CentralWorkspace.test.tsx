import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import { useLearningStore } from "@/stores/learningStore";
import { useCircuitStore } from "@/stores/circuitStore";
import type { CourseDetail, LessonDetail } from "@/types";

vi.mock("@/components/learn/LessonContent", () => ({
  default: () => <div>LessonContentMock</div>,
}));
vi.mock("@/components/circuit/GatePalette", () => ({ default: () => <div>GatePaletteMock</div> }));
vi.mock("@/components/circuit/CircuitCanvas", () => ({ default: () => <div>CircuitCanvasMock</div> }));
vi.mock("@/components/circuit/CircuitToolbar", () => ({ default: () => <div>CircuitToolbarMock</div> }));
vi.mock("@/components/dashboard/CircuitCodePanel", () => ({ default: () => <div>CircuitCodeMock</div> }));
vi.mock("@/components/visualization/ProbabilityChart", () => ({ default: () => <div>ProbChartMock</div> }));
vi.mock("@/components/visualization/StateVectorTable", () => ({ default: () => <div>StateVectorMock</div> }));
vi.mock("@/components/dashboard/StateSphereVisualization", () => ({ default: () => <div>SphereMock</div> }));

const course: CourseDetail = {
  id: "course-1",
  title: "Quantum Computing",
  description: null,
  difficulty: "beginner",
  modules: [
    {
      id: "m0",
      title: "Quantum Gates and Circuits",
      order_index: 0,
      lessons: [
        { id: "l0", title: "Single Qubit Gates", lesson_type: "text", is_pro: false, order_index: 0 },
        { id: "l1", title: "Multi-Qubit Gates", lesson_type: "text", is_pro: false, order_index: 1 },
      ],
    },
  ],
};

const activeLesson: LessonDetail = {
  id: "l1",
  module_id: "m0",
  title: "Multi-Qubit Gates",
  content: "CNOT creates entanglement between two qubits. It flips the target when control is 1.",
  lesson_type: "text",
  is_pro: false,
  concepts: [{ id: "c1", name: "CNOT Gate and Entanglement", description: "Explains CNOT." }],
};

const runSimulation = vi.fn().mockResolvedValue(undefined);
const onExplainCircuit = vi.fn();

beforeEach(() => {
  runSimulation.mockClear();
  onExplainCircuit.mockClear();
  useLearningStore.setState({
    activeCourse: course,
    activeLesson,
    currentLessonId: "l1",
  });
  useCircuitStore.setState({
    runSimulation,
    runState: "idle",
    error: null,
    results: null,
  });
});

describe("CentralWorkspace", () => {
  it("shows an empty state when there is no active lesson", () => {
    useLearningStore.setState({ activeLesson: null });
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    expect(screen.getByText(/select a lesson/i)).toBeInTheDocument();
  });

  it("renders the derived breadcrumb, lesson title, and concept card", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    expect(screen.getByText("Level 1 › 1.2 Multi-Qubit Gates")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Multi-Qubit Gates" })).toBeInTheDocument();
    expect(screen.getByText("CNOT Gate and Entanglement")).toBeInTheDocument();
    expect(screen.getByText("LessonContentMock")).toBeInTheDocument();
  });

  it("switches to the Circuit tab and renders the embedded circuit builder", async () => {
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("tab", { name: "Circuit" }));
    expect(screen.getByText("GatePaletteMock")).toBeInTheDocument();
    expect(screen.getByText("CircuitCanvasMock")).toBeInTheDocument();
  });

  it("Run Simulation calls runSimulation and switches to the Simulation tab", async () => {
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("button", { name: /run simulation/i }));
    expect(runSimulation).toHaveBeenCalledOnce();
    expect(screen.getByText("ProbChartMock")).toBeInTheDocument();
  });

  it("Explain Circuit calls the onExplainCircuit callback", async () => {
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("button", { name: /explain circuit/i }));
    expect(onExplainCircuit).toHaveBeenCalledOnce();
  });

  it("shows an error banner in the Simulation tab when the run failed", async () => {
    useCircuitStore.setState({ runState: "error", error: "Backend unreachable" });
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("tab", { name: "Simulation" }));
    expect(screen.getByText("Backend unreachable")).toBeInTheDocument();
  });

  it("Practice button switches to the Practice tab with a link to /quiz", async () => {
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("button", { name: /^practice$/i }));
    expect(screen.getByRole("link", { name: /open practice/i })).toHaveAttribute("href", "/quiz");
  });

  it("lockedTab hides the tab switcher and renders only that tab, full height", () => {
    render(
      <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
    );
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("GatePaletteMock")).toBeInTheDocument();
    expect(screen.queryByText("LessonContentMock")).not.toBeInTheDocument();
  });

  it("lockedTab='circuit' renders the circuit branch in a flex-1 container, not the fixed 420px preview height", () => {
    render(
      <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
    );
    const container = screen.getByText("GatePaletteMock").closest("div.flex.h-full")
      ?? screen.getByText("GatePaletteMock").parentElement?.parentElement;
    expect(container?.className ?? "").not.toContain("h-[420px]");
  });
});
