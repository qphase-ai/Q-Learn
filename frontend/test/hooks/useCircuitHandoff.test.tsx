import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCircuitHandoff } from "@/hooks/useCircuitHandoff";
import { stashCircuitForBuilder, type CircuitHandoff } from "@/lib/circuit-handoff";
import { useCircuitStore } from "@/stores/circuitStore";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const bell: CircuitHandoff = {
  qubits: 2,
  gates: [{ type: "H", targets: [0] }, { type: "CX", targets: [1], control: 0 }],
  name: "Bell state",
};

describe("useCircuitHandoff", () => {
  beforeEach(() => {
    useCircuitStore.setState({ nodes: [], qubitCount: 2, circuitName: "Untitled Circuit" });
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("does the first render not-standalone and unchecked, then settles after mount", () => {
    stashCircuitForBuilder(bell);
    const seen: { standalone: boolean; checked: boolean }[] = [];
    renderHook(() => {
      const r = useCircuitHandoff(true);
      seen.push(r);
      return r;
    });
    expect(seen[0]).toEqual({ standalone: false, checked: false });
    expect(seen[seen.length - 1]).toEqual({ standalone: true, checked: true });
  });

  it("loads a stashed circuit into the store and toasts", () => {
    stashCircuitForBuilder(bell);
    renderHook(() => useCircuitHandoff(true));
    const s = useCircuitStore.getState();
    expect(s.nodes).toHaveLength(2);
    expect(s.circuitName).toBe("Bell state");
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("is one-shot: the stash is consumed, a later mount is checked but not standalone", () => {
    stashCircuitForBuilder(bell);
    renderHook(() => useCircuitHandoff(true));
    const { result } = renderHook(() => useCircuitHandoff(true));
    expect(result.current).toEqual({ standalone: false, checked: true });
  });

  it("does nothing, and leaves the stash alone, when disabled", () => {
    stashCircuitForBuilder(bell);
    const { result } = renderHook(() => useCircuitHandoff(false));
    expect(result.current).toEqual({ standalone: false, checked: false });
    expect(useCircuitStore.getState().nodes).toHaveLength(0);
    expect(window.sessionStorage.getItem("qlearn.circuit-handoff")).not.toBeNull();
  });
});
