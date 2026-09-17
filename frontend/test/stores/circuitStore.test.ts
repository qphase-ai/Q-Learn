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
import { nodesToCircuitSpec } from "@/lib/circuit-spec";
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
    bottomPanelOpen: false,
    bottomPanelTab: "probabilities",
    rightPanelOpen: true,
    focusMode: false,
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
  it("decrements qubitCount and drops nodes on the removed qubit", () => {
    useCircuitStore.setState({ qubitCount: 3 });
    useCircuitStore.getState().placeGate("H", 0, 0);
    useCircuitStore.getState().placeGate("X", 1, 0);
    useCircuitStore.getState().placeGate("Z", 2, 0);

    useCircuitStore.getState().removeQubit(2);

    const { qubitCount, nodes } = useCircuitStore.getState();
    expect(qubitCount).toBe(2);
    expect(nodes.every((n) => (n.data as { qubit: number }).qubit < 2)).toBe(true);
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

  it("onResult sets results + runState='success' and opens BottomPanel on 'probabilities'", async () => {
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
    expect(useShellStore.getState().bottomPanelOpen).toBe(true);
    expect(useShellStore.getState().bottomPanelTab).toBe("probabilities");
  });

  it("sets runState='error' and captures the message when apiFetch throws", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Network error"));

    await useCircuitStore.getState().runSimulation();

    expect(useCircuitStore.getState().runState).toBe("error");
    expect(useCircuitStore.getState().error).toBe("Network error");
  });
});
