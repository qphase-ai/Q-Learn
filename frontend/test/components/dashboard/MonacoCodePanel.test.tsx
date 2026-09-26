import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("follows the live circuit while unedited, keeping Run enabled", async () => {
    render(<MonacoCodePanel />);
    const editor = (await screen.findByLabelText(
      "code editor"
    )) as HTMLTextAreaElement;
    expect(screen.getByRole("button", { name: /run/i })).toBeEnabled();

    // Simulate a circuit edit on the Circuit tab (not the code buffer itself).
    act(() => {
      useCircuitStore.setState({ nodes: [], qubitCount: 3 });
    });

    await waitFor(() => {
      expect(editor.value).toContain("QuantumCircuit(3, 3)");
    });
    expect(screen.getByRole("button", { name: /run/i })).toBeEnabled();
  });

  it("shows the no-backend-sandbox tooltip on hover once the buffer is edited", async () => {
    const user = userEvent.setup();
    render(<MonacoCodePanel />);
    const editor = await screen.findByLabelText("code editor");
    await user.type(editor, "\n# edited");
    const runButton = screen.getByRole("button", { name: /run/i });
    expect(runButton).toBeDisabled();

    // The trigger is the plain <span> wrapping the disabled button — disabled
    // DOM elements don't reliably fire the pointer events Radix needs.
    await user.hover(runButton.parentElement as HTMLElement);
    expect(
      await screen.findByText(/no.*sandbox|isn.t connected to a backend sandbox/i)
    ).toBeInTheDocument();
  });

  it("does not silently overwrite an edited buffer when the circuit changes again", async () => {
    const user = userEvent.setup();
    render(<MonacoCodePanel />);
    const editor = (await screen.findByLabelText(
      "code editor"
    )) as HTMLTextAreaElement;

    await user.type(editor, "\n# edited");
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
    const editedValue = editor.value;

    // Circuit changes again while the buffer is diverged — buffer must stay frozen.
    act(() => {
      useCircuitStore.setState({ nodes: [], qubitCount: 4 });
    });

    await waitFor(() => {
      expect(useCircuitStore.getState().qubitCount).toBe(4);
    });
    expect(editor.value).toBe(editedValue);
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });
});
