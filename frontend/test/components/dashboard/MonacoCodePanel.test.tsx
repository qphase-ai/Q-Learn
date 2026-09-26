import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MonacoCodePanel from "@/components/dashboard/MonacoCodePanel";
import { useCircuitStore } from "@/stores/circuitStore";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string | undefined) => void;
  }) => (
    <textarea
      aria-label="code editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const runSimulation = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  runSimulation.mockClear();
  useCircuitStore.setState({
    nodes: [],
    qubitCount: 2,
    runSimulation,
    runState: "idle",
  });
});

describe("MonacoCodePanel", () => {
  it("seeds the editor with the generated Qiskit source", async () => {
    render(<MonacoCodePanel />);
    const editor = (await screen.findByLabelText(
      "code editor"
    )) as HTMLTextAreaElement;
    expect(editor.value).toContain("from qiskit import QuantumCircuit");
  });

  it("Run is enabled and calls runSimulation when the buffer is unedited", async () => {
    const user = userEvent.setup();
    render(<MonacoCodePanel />);
    await screen.findByLabelText("code editor");
    const runButton = screen.getByRole("button", { name: /run/i });
    expect(runButton).toBeEnabled();
    await user.click(runButton);
    expect(runSimulation).toHaveBeenCalledOnce();
  });

  it("Run is disabled once the buffer diverges from the generated source", async () => {
    const user = userEvent.setup();
    render(<MonacoCodePanel />);
    const editor = await screen.findByLabelText("code editor");
    await user.type(editor, "\n# edited");
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });
});
