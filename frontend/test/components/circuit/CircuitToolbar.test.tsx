import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CircuitToolbar from "@/components/circuit/CircuitToolbar";
import { useCircuitStore } from "@/stores/circuitStore";

Object.defineProperty(globalThis, "URL", {
  value: {
    ...globalThis.URL,
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  },
  writable: true,
});

type SetState = Parameters<typeof useCircuitStore.setState>[0];

beforeEach(() => {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({
    circuitName: "Untitled Circuit",
    qubitCount: 2,
    runState: "idle",
    error: null,
  });
});

describe("CircuitToolbar", () => {
  it("shows the circuit name and renames it inline", async () => {
    const user = userEvent.setup();
    useCircuitStore.setState({ circuitName: "Bell State" });
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: /Circuit name: Bell State/ }));
    const input = screen.getByRole("textbox", { name: "Circuit name" });
    await user.clear(input);
    await user.type(input, "My Circuit{Enter}");
    expect(useCircuitStore.getState().circuitName).toBe("My Circuit");
    expect(screen.getByRole("button", { name: /Circuit name: My Circuit/ })).toBeInTheDocument();
  });

  it("Escape cancels a rename", async () => {
    const user = userEvent.setup();
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: /Circuit name/ }));
    await user.type(screen.getByRole("textbox"), "zzz{Escape}");
    expect(useCircuitStore.getState().circuitName).toBe("Untitled Circuit");
  });

  it("shows the qubit count and Add Qubit calls addQubit", async () => {
    const user = userEvent.setup();
    const addQubit = vi.fn();
    useCircuitStore.setState({ qubitCount: 3, addQubit } as unknown as SetState);
    render(<CircuitToolbar />);
    expect(screen.getByRole("button", { name: /3 qubits/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add qubit" }));
    expect(addQubit).toHaveBeenCalledOnce();
  });

  it("the qubit dropdown sets an exact count", async () => {
    const user = userEvent.setup();
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: /2 qubits/ }));
    await user.click(await screen.findByRole("menuitem", { name: /5 qubits/ }));
    expect(useCircuitStore.getState().qubitCount).toBe(5);
  });

  it("Run Simulation is enabled when idle and calls runSimulation", async () => {
    const user = userEvent.setup();
    const runSimulation = vi.fn().mockResolvedValue(undefined);
    useCircuitStore.setState({ runSimulation } as unknown as SetState);
    render(<CircuitToolbar />);
    const btn = screen.getByRole("button", { name: "Run Simulation" });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(runSimulation).toHaveBeenCalledOnce();
  });

  it("shows 'Simulating…' and is disabled while running", () => {
    useCircuitStore.setState({ runState: "running" });
    render(<CircuitToolbar />);
    expect(screen.getByRole("button", { name: "Simulating…" })).toBeDisabled();
  });

  it("shows 'Simulation Complete' briefly after a run succeeds", () => {
    vi.useFakeTimers();
    try {
      useCircuitStore.setState({ runState: "running" });
      render(<CircuitToolbar />);
      act(() => useCircuitStore.setState({ runState: "success" }));
      expect(screen.getByRole("button", { name: "Simulation Complete" })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(3000));
      expect(screen.getByRole("button", { name: "Run Simulation" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Clear calls clearCircuit (disabled on an empty, unrun circuit)", async () => {
    const user = userEvent.setup();
    const clearCircuit = vi.fn();
    useCircuitStore.setState({ clearCircuit } as unknown as SetState);
    const { rerender } = render(<CircuitToolbar />);
    expect(screen.getByRole("button", { name: "Clear circuit" })).toBeDisabled();
    act(() => useCircuitStore.getState().placeGate("H", 0, 0));
    rerender(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: "Clear circuit" }));
    expect(clearCircuit).toHaveBeenCalledOnce();
  });

  it("Undo/Redo reflect history availability", async () => {
    const user = userEvent.setup();
    render(<CircuitToolbar />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    act(() => useCircuitStore.getState().placeGate("H", 0, 0));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
  });

  it("Export offers JSON, OpenQASM and Qiskit and downloads a Blob", async () => {
    const user = userEvent.setup();
    vi.mocked(URL.createObjectURL).mockClear();
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: "Export circuit" }));
    expect(await screen.findByRole("menuitem", { name: /OpenQASM 2.0/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Qiskit Python/ })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Circuit JSON/ }));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("only renders the library toggle when a handler is passed", () => {
    const { rerender } = render(<CircuitToolbar />);
    expect(screen.queryByRole("button", { name: /gate library/ })).not.toBeInTheDocument();
    rerender(<CircuitToolbar onToggleLibrary={() => {}} libraryOpen={false} />);
    expect(screen.getByRole("button", { name: "Show gate library" })).toBeInTheDocument();
  });
});
