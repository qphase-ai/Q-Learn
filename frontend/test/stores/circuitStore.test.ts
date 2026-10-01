import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SimulationResult } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — Vitest hoists vi.mock() calls, so they run before any import
// ---------------------------------------------------------------------------

let capturedOnResult: ((payload: SimulationResult) => void) | null = null;

vi.mock("@/lib/supabase", () => ({
  subscribeToCircuitResult: vi.fn(
    (_circuitId: string, onResult: (payload: SimulationResult) => void) => {
      capturedOnResult = onResult;
      return () => {}; // no-op unsubscribe
    }
  ),
  getAccessToken: vi.fn(async () => undefined),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Static imports resolved after mocks
// ---------------------------------------------------------------------------
import { useCircuitStore } from "@/stores/circuitStore";
import { useAuthStore } from "@/stores/authStore";
import { useShellStore } from "@/stores/shellStore";
import { nodesToCircuitSpec, xyFromCell } from "@/lib/circuit-spec";
import { apiFetch } from "@/lib/api";
import { subscribeToCircuitResult } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  capturedOnResult = null;

  useCircuitStore.getState().reset();
  // reset() only clears nodes/edges/runState/results — patch the rest
  useCircuitStore.setState({ circuitName: "Untitled", qubitCount: 2, error: null });

  useAuthStore.setState({ jwt: "t", user: null, isLoading: false });

  useShellStore.setState({
    activeWorkspace: "circuit",
  });

  vi.clearAllMocks();

  // Restore mock implementations after clearAllMocks
  vi.mocked(apiFetch).mockResolvedValue({} as never);
  vi.mocked(subscribeToCircuitResult).mockImplementation((_id, onResult) => {
    capturedOnResult = onResult as (payload: SimulationResult) => void;
    return () => {};
  });
});

// ---------------------------------------------------------------------------
// placeGate
// ---------------------------------------------------------------------------
describe("placeGate", () => {
  it("adds one node with data.type === 'H'", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    const { nodes } = useCircuitStore.getState();
    expect(nodes).toHaveLength(1);
    expect((nodes[0].data as { type: string }).type).toBe("H");
  });

  it("sets node.type='gate' for non-measurement gates", () => {
    useCircuitStore.getState().placeGate("X", 1, 2);
    expect(useCircuitStore.getState().nodes[0].type).toBe("gate");
  });

  it("sets node.type='measurement' for M gate", () => {
    useCircuitStore.getState().placeGate("M", 0, 3);
    expect(useCircuitStore.getState().nodes[0].type).toBe("measurement");
  });
});

// ---------------------------------------------------------------------------
// removeQubit
// ---------------------------------------------------------------------------
describe("removeQubit", () => {
  it("decrements qubitCount and drops nodes on the removed top qubit", () => {
    useCircuitStore.setState({ qubitCount: 3 });
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().placeGate("X", 1, 0);
    useCircuitStore.getState().placeGate("Z", 2, 0);

    useCircuitStore.getState().removeQubit(2);

    const { qubitCount, nodes } = useCircuitStore.getState();
    expect(qubitCount).toBe(2);
    expect(nodes.every((n) => (n.data as { qubit: number }).qubit < 2)).toBe(true);
  });

  it("removes the requested qubit and shifts higher-indexed qubits down", () => {
    useCircuitStore.setState({ qubitCount: 3 });
    // gate on qubit 0 and gate on qubit 2
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().placeGate("Z", 2, 0);

    useCircuitStore.getState().removeQubit(0);

    const { qubitCount, nodes } = useCircuitStore.getState();
    expect(qubitCount).toBe(2);
    // qubit-0 gate removed; qubit-2 gate shifts down to qubit 1
    expect(nodes).toHaveLength(1);
    expect((nodes[0].data as { type: string }).type).toBe("Z");
    expect((nodes[0].data as { qubit: number }).qubit).toBe(1);
  });

  it("never drops below qubitCount=1", () => {
    useCircuitStore.setState({ qubitCount: 1 });
    useCircuitStore.getState().removeQubit(0);
    expect(useCircuitStore.getState().qubitCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// clearCircuit
// ---------------------------------------------------------------------------
describe("clearCircuit", () => {
  it("empties nodes+edges, resets runState='idle', clears results and error", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.setState({ runState: "success", error: "prior" });
    useCircuitStore.getState().clearCircuit();

    const s = useCircuitStore.getState();
    expect(s.nodes).toHaveLength(0);
    expect(s.edges).toHaveLength(0);
    expect(s.runState).toBe("idle");
    expect(s.results).toBeNull();
    expect(s.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------
describe("runSimulation", () => {
  it("sets runState='running' synchronously before the POST resolves", async () => {
    let resolvePost!: (v: unknown) => void;
    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise((res) => { resolvePost = res; })
    );

    useCircuitStore.getState().placeGate("H", 0, 0);
    const runPromise = useCircuitStore.getState().runSimulation();
    await Promise.resolve(); // one microtask tick

    expect(useCircuitStore.getState().runState).toBe("running");
    resolvePost({});
    await runPromise;
  });

  it("calls apiFetch once with correct path, method, token, and body", async () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    const { nodes, qubitCount, circuitName } = useCircuitStore.getState();
    const expectedCircuit = nodesToCircuitSpec(nodes, qubitCount);

    await useCircuitStore.getState().runSimulation();

    expect(apiFetch).toHaveBeenCalledOnce();
    const call = vi.mocked(apiFetch).mock.calls[0];
    const path = call[0];
    const opts = call[1]!;

    // Path must match /api/v1/circuits/<uuid>/execute
    expect(path).toMatch(
      /^\/api\/v1\/circuits\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/execute$/
    );
    expect(opts.method).toBe("POST");
    expect(opts.token).toBe("t");

    const body = JSON.parse(opts.body as string);
    expect(body.circuit).toEqual(expectedCircuit);
    expect(body.shots).toBe(1024);
    expect(body.name).toBe(circuitName);
  });

  it("onResult sets results + runState='success'", async () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    await useCircuitStore.getState().runSimulation();

    expect(capturedOnResult).not.toBeNull();

    const payload: SimulationResult = {
      status: "completed",
      probabilities: { "00": 0.5, "11": 0.5 },
      measurements: {},
      statevector: null,
      qasm: "x",
      execution_time_ms: 5,
    };

    capturedOnResult!(payload);

    expect(useCircuitStore.getState().results).toEqual(payload);
    expect(useCircuitStore.getState().runState).toBe("success");
  });

  it("onResult with status='failed' sets runState='error' and keeps error_message", async () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    await useCircuitStore.getState().runSimulation();

    expect(capturedOnResult).not.toBeNull();

    capturedOnResult!({
      status: "failed",
      probabilities: null,
      measurements: null,
      statevector: null,
      qasm: null,
      execution_time_ms: null,
      error_message: "boom",
    });

    expect(useCircuitStore.getState().runState).toBe("error");
    expect(useCircuitStore.getState().results?.error_message).toBe("boom");
  });

  it("sets runState='error' and captures the message when apiFetch throws", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Network error"));

    await useCircuitStore.getState().runSimulation();

    expect(useCircuitStore.getState().runState).toBe("error");
    expect(useCircuitStore.getState().error).toBe("Network error");
  });
});

// ---------------------------------------------------------------------------
// Editor actions added for the circuit lab
// ---------------------------------------------------------------------------
const cells = () =>
  useCircuitStore
    .getState()
    .nodes.map((n) => {
      const d = n.data as { type: string; qubit: number; column: number; control?: number };
      return `${d.type}@${d.qubit}${d.control !== undefined ? `/${d.control}` : ""}:${d.column}`;
    })
    .sort();

describe("placement", () => {
  it("shifts to the next free column when the cell is occupied", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().placeGate("X", 0, 0);
    expect(cells()).toEqual(["H@0:0", "X@0:1"]);
  });

  it("two-qubit gates block every row they span", () => {
    useCircuitStore.setState({ qubitCount: 3 });
    useCircuitStore.getState().placeTwoQubitGate("CX", 0, 2, 0);
    useCircuitStore.getState().placeGate("H", 1, 0);
    expect(cells()).toEqual(["CX@2/0:0", "H@1:1"]);
  });

  it("parametric gates get default params", () => {
    useCircuitStore.getState().placeGate("RX", 0, 0);
    const d = useCircuitStore.getState().nodes[0].data as { params?: { theta?: number } };
    expect(d.params?.theta).toBeCloseTo(Math.PI / 2);
  });

  it("placeAtNextFreeColumn appends after existing gates", () => {
    useCircuitStore.getState().placeGate("H", 1, 0);
    useCircuitStore.getState().placeAtNextFreeColumn("CX", 1);
    expect(cells()).toEqual(["CX@1/0:1", "H@1:0"]);
  });
});

describe("history", () => {
  it("undo/redo restore nodes and qubit count", () => {
    const s = useCircuitStore.getState();
    s.placeGate("H", 0, 0);
    s.addQubit();
    expect(useCircuitStore.getState().qubitCount).toBe(3);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().qubitCount).toBe(2);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
    useCircuitStore.getState().redo();
    expect(cells()).toEqual(["H@0:0"]);
    expect(useCircuitStore.getState().future).toHaveLength(1);
  });

  it("a new edit clears the redo stack", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().undo();
    useCircuitStore.getState().placeGate("X", 0, 0);
    expect(useCircuitStore.getState().future).toHaveLength(0);
  });

  it("clearCircuit is undoable", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().clearCircuit();
    useCircuitStore.getState().undo();
    expect(cells()).toEqual(["H@0:0"]);
  });

  it("selection changes are not recorded", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    const id = useCircuitStore.getState().nodes[0].id;
    useCircuitStore.getState().selectGate(id);
    expect(useCircuitStore.getState().past).toHaveLength(1);
  });
});

describe("moveGate", () => {
  it("moves a gate and syncs its pixel position", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    const id = useCircuitStore.getState().nodes[0].id;
    expect(useCircuitStore.getState().moveGate(id, 1, 3)).toBe(true);
    const n = useCircuitStore.getState().nodes[0];
    expect(cells()).toEqual(["H@1:3"]);
    expect(n.position).toEqual(xyFromCell(1, 3));
  });

  it("snaps back when the target cell is occupied or out of range", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().placeGate("X", 1, 0);
    const id = useCircuitStore.getState().nodes[0].id;
    expect(useCircuitStore.getState().moveGate(id, 1, 0)).toBe(false);
    expect(useCircuitStore.getState().moveGate(id, 5, 0)).toBe(false);
    expect(cells()).toEqual(["H@0:0", "X@1:0"]);
  });

  it("moves the control of a two-qubit gate with it", () => {
    useCircuitStore.setState({ qubitCount: 3 });
    useCircuitStore.getState().placeTwoQubitGate("CX", 0, 1, 0);
    const id = useCircuitStore.getState().nodes[0].id;
    useCircuitStore.getState().moveGate(id, 2, 2);
    expect(cells()).toEqual(["CX@2/1:2"]);
  });
});

describe("updateGate / duplicate / qubit count", () => {
  it("updates params and rejects control === target", () => {
    useCircuitStore.getState().placeTwoQubitGate("RZZ", 0, 1, 0);
    const id = useCircuitStore.getState().nodes[0].id;
    expect(useCircuitStore.getState().updateGate(id, { params: { theta: 1 } })).toBe(true);
    expect((useCircuitStore.getState().nodes[0].data as { params: { theta: number } }).params.theta).toBe(1);
    expect(useCircuitStore.getState().updateGate(id, { control: 1 })).toBe(false);
  });

  it("duplicates the selection into the next free column and selects the copy", () => {
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().selectGate(useCircuitStore.getState().nodes[0].id);
    useCircuitStore.getState().duplicateSelected();
    expect(cells()).toEqual(["H@0:0", "H@0:1"]);
    expect(useCircuitStore.getState().nodes.filter((n) => n.selected)).toHaveLength(1);
  });

  it("removeQubit drops gates controlled by the removed qubit and shifts controls", () => {
    useCircuitStore.setState({ qubitCount: 4 });
    useCircuitStore.getState().placeTwoQubitGate("CX", 1, 2, 0);
    useCircuitStore.getState().placeTwoQubitGate("CZ", 2, 3, 1);
    useCircuitStore.getState().removeQubit(1);
    expect(cells()).toEqual(["CZ@2/1:1"]);
  });

  it("setQubitCount clamps to 1..8 and drops gates beyond the new range", () => {
    useCircuitStore.getState().placeGate("H", 1, 0);
    useCircuitStore.getState().setQubitCount(1);
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
    useCircuitStore.getState().setQubitCount(99);
    expect(useCircuitStore.getState().qubitCount).toBe(8);
  });

  it("runSimulation sends the selected shot count", async () => {
    useCircuitStore.getState().setShots(2048);
    await useCircuitStore.getState().runSimulation();
    const body = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]!.body as string);
    expect(body.shots).toBe(2048);
    useCircuitStore.getState().setShots(1024);
  });
});
