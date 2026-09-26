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
vi.mock("@/components/dashboard/FileTreePanel", () => ({ default: () => <div>FileTreeMock</div> }));
vi.mock("@/components/dashboard/MonacoCodePanel", () => ({ default: () => <div>MonacoCodeMock</div> }));
vi.mock("@/components/dashboard/CircuitResultsPanel", () => ({
  default: () => <div>ResultsPanelMock</div>,
}));

const useCircuitShortcuts = vi.fn();
vi.mock("@/hooks/useCircuitShortcuts", () => ({
  useCircuitShortcuts: (enabled?: boolean) => useCircuitShortcuts(enabled),
}));

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
  useCircuitShortcuts.mockClear();
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

  it("switches to the Code tab in embedded mode and renders the editor without the file tree", async () => {
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByText("MonacoCodeMock")).toBeInTheDocument();
    expect(screen.queryByText("FileTreeMock")).not.toBeInTheDocument();
  });

  it("Run Simulation calls runSimulation and switches to the Simulation tab", async () => {
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("button", { name: /run simulation/i }));
    expect(runSimulation).toHaveBeenCalledOnce();
    expect(screen.getByText("ResultsPanelMock")).toBeInTheDocument();
  });

  it("Explain Circuit calls the onExplainCircuit callback", async () => {
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("button", { name: /explain circuit/i }));
    expect(onExplainCircuit).toHaveBeenCalledOnce();
  });

  it("shows the results panel in the Simulation tab", async () => {
    useCircuitStore.setState({ runState: "error", error: "Backend unreachable" });
    const user = userEvent.setup();
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    await user.click(screen.getByRole("tab", { name: "Simulation" }));
    expect(screen.getByText("ResultsPanelMock")).toBeInTheDocument();
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

  it("lockedTab='circuit' keeps the canvas row at a fixed 420px height", () => {
    render(
      <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
    );
    // The canvas row is GatePaletteMock's direct parent — it stays h-[420px] in
    // both locked and unlocked mode after Step 10's restructuring; only the
    // outer wrapper (asserted separately below) grows to flex-1 when locked.
    const canvasRow = screen.getByText("GatePaletteMock").parentElement;
    expect(canvasRow?.className ?? "").toContain("h-[420px]");
  });

  it("lockedTab='circuit' wraps the canvas row and results panel in a flex-1 scrollable container", () => {
    useCircuitStore.setState({ runState: "success" });
    render(
      <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
    );
    const canvasRow = screen.getByText("GatePaletteMock").parentElement;
    const outerWrapper = canvasRow?.parentElement;
    expect(outerWrapper?.className ?? "").toContain("flex-1");
    expect(outerWrapper?.contains(screen.getByText("ResultsPanelMock"))).toBe(true);
  });

  it("lockedTab='circuit' shows CircuitResultsPanel below the canvas once a run has happened", () => {
    useCircuitStore.setState({ runState: "success" });
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />);
    expect(screen.getByText("ResultsPanelMock")).toBeInTheDocument();
  });

  it("lockedTab='circuit' hides CircuitResultsPanel before any run", () => {
    useCircuitStore.setState({ runState: "idle" });
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />);
    expect(screen.queryByText("ResultsPanelMock")).not.toBeInTheDocument();
  });

  it("lockedTab='code' renders both the file tree and the code editor", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="code" />);
    expect(screen.getByText("FileTreeMock")).toBeInTheDocument();
    expect(screen.getByText("MonacoCodeMock")).toBeInTheDocument();
  });

  it("only enables circuit keyboard shortcuts when lockedTab='circuit'", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />);
    expect(useCircuitShortcuts).toHaveBeenCalledWith(true);
  });

  it("does not enable circuit keyboard shortcuts on other locked tabs", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="code" />);
    expect(useCircuitShortcuts).toHaveBeenCalledWith(false);
  });

  it("does not enable circuit keyboard shortcuts in the embedded dashboard preview", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} />);
    expect(useCircuitShortcuts).toHaveBeenCalledWith(false);
  });

  it("hides Run Simulation on the locked code tab", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="code" />);
    expect(screen.queryByRole("button", { name: /run simulation/i })).not.toBeInTheDocument();
  });

  it("keeps Run Simulation on the locked lesson tab and shows results inline once run", () => {
    useCircuitStore.setState({ runState: "success" });
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="lesson" />);
    expect(screen.getByRole("button", { name: /run simulation/i })).toBeInTheDocument();
    expect(screen.getByText("ResultsPanelMock")).toBeInTheDocument();
  });

  it("hides results on the locked lesson tab before any run", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="lesson" />);
    expect(screen.queryByText("ResultsPanelMock")).not.toBeInTheDocument();
  });

  it("shows results below the editor on the locked code tab once a run has happened", () => {
    useCircuitStore.setState({ runState: "success" });
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="code" />);
    expect(screen.getByText("ResultsPanelMock")).toBeInTheDocument();
  });

  it("the Practice button links straight to /quiz on locked routes", () => {
    render(<CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="lesson" />);
    expect(screen.getByRole("link", { name: /practice/i })).toHaveAttribute("href", "/quiz");
  });
});
