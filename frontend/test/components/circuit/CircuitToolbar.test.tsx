import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CircuitToolbar from "@/components/circuit/CircuitToolbar";
import { useCircuitStore } from "@/stores/circuitStore";

// Mock nodesToCircuitSpec so Export JSON doesn't fail
vi.mock("@/lib/circuit-spec", async () => {
  const actual = await import("@/lib/circuit-spec");
  return { ...actual };
});

// Mock URL.createObjectURL and revokeObjectURL for the export test
Object.defineProperty(globalThis, "URL", {
  value: {
    ...globalThis.URL,
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  },
  writable: true,
});

beforeEach(() => {
  useCircuitStore.getState().reset();
  useCircuitStore.setState({
    circuitName: "Untitled",
    qubitCount: 2,
    selectedGateType: null,
    runState: "idle",
    error: null,
  });
});

describe("CircuitToolbar", () => {
  it("renders the circuit name input with current value", () => {
    useCircuitStore.setState({ circuitName: "Bell State" });
    render(<CircuitToolbar />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Bell State");
  });

  it("typing in the name input calls renameCircuit", async () => {
    const user = userEvent.setup();
    render(<CircuitToolbar />);
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "My Circuit");
    expect(useCircuitStore.getState().circuitName).toBe("My Circuit");
  });

  it("shows qubit count and +/- buttons", () => {
    useCircuitStore.setState({ qubitCount: 3 });
    render(<CircuitToolbar />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "−" })).toBeInTheDocument();
  });

  it("clicking + calls addQubit", async () => {
    const user = userEvent.setup();
    const addQubit = vi.fn();
    useCircuitStore.setState({ addQubit } as unknown as Parameters<typeof useCircuitStore.setState>[0]);
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: "+" }));
    expect(addQubit).toHaveBeenCalledOnce();
  });

  it("clicking − calls removeQubit with qubitCount-1", async () => {
    const user = userEvent.setup();
    const removeQubit = vi.fn();
    useCircuitStore.setState({
      qubitCount: 3,
      removeQubit,
    } as unknown as Parameters<typeof useCircuitStore.setState>[0]);
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: "−" }));
    expect(removeQubit).toHaveBeenCalledWith(2);
  });

  it("Run button shows 'Run' and is enabled when runState is idle", () => {
    useCircuitStore.setState({ runState: "idle" });
    render(<CircuitToolbar />);
    const btn = screen.getByRole("button", { name: /run/i });
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent(/run/i);
  });

  it("Run button is disabled when runState is running", () => {
    useCircuitStore.setState({ runState: "running" });
    render(<CircuitToolbar />);
    const btn = screen.getByRole("button", { name: /running/i });
    expect(btn).toBeDisabled();
  });

  it("Run button shows 'Running…' when runState is running", () => {
    useCircuitStore.setState({ runState: "running" });
    render(<CircuitToolbar />);
    expect(screen.getByText(/running…/i)).toBeInTheDocument();
  });

  it("clicking Run calls runSimulation", async () => {
    const user = userEvent.setup();
    const runSimulation = vi.fn().mockResolvedValue(undefined);
    useCircuitStore.setState({
      runState: "idle",
      runSimulation,
    } as unknown as Parameters<typeof useCircuitStore.setState>[0]);
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: /^run$/i }));
    expect(runSimulation).toHaveBeenCalledOnce();
  });

  it("Clear button calls clearCircuit", async () => {
    const user = userEvent.setup();
    const clearCircuit = vi.fn();
    useCircuitStore.setState({
      clearCircuit,
    } as unknown as Parameters<typeof useCircuitStore.setState>[0]);
    render(<CircuitToolbar />);
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(clearCircuit).toHaveBeenCalledOnce();
  });

  it("Export JSON button is present", () => {
    render(<CircuitToolbar />);
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });
});
