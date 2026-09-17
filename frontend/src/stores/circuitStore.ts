import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import type { GateType, GateNodeData, SimulationResult } from "@/types";
import { nodesToCircuitSpec, xyFromCell } from "@/lib/circuit-spec";
import { subscribeToCircuitResult } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useShellStore } from "@/stores/shellStore";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface CircuitStore {
  // State
  nodes: Node[];
  edges: Edge[];
  circuitName: string;
  qubitCount: number;
  selectedGateType: GateType | null;
  runState: "idle" | "running" | "success" | "error";
  results: SimulationResult | null;
  error: string | null;

  // Setters
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedGateType: (type: GateType | null) => void;
  setResults: (results: SimulationResult | null) => void;
  setRunState: (state: CircuitStore["runState"]) => void;

  // Circuit-editing actions
  renameCircuit: (name: string) => void;
  addQubit: () => void;
  removeQubit: (index: number) => void;
  placeGate: (type: GateType, qubit: number, column: number) => void;
  placeTwoQubitGate: (
    type: GateType,
    control: number,
    target: number,
    column: number
  ) => void;
  removeSelected: () => void;
  clearCircuit: () => void;

  // Orchestrator
  runSimulation: () => Promise<void>;

  // Reset
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────
  nodes: [],
  edges: [],
  circuitName: "Untitled",
  qubitCount: 2,
  selectedGateType: null,
  runState: "idle",
  results: null,
  error: null,

  // ── Simple setters ─────────────────────────────────────────────────────
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedGateType: (selectedGateType) => set({ selectedGateType }),
  setResults: (results) => set({ results }),
  setRunState: (runState) => set({ runState }),

  // ── Circuit-editing actions ────────────────────────────────────────────

  renameCircuit: (name) => set({ circuitName: name }),

  addQubit: () => set((s) => ({ qubitCount: s.qubitCount + 1 })),

  removeQubit: (index) =>
    set((s) => {
      if (s.qubitCount <= 1) return {};
      return {
        qubitCount: s.qubitCount - 1,
        nodes: s.nodes
          .filter((n) => ((n.data as unknown) as GateNodeData).qubit !== index)
          .map((n) => {
            const d = (n.data as unknown) as GateNodeData;
            return d.qubit > index
              ? ({ ...n, data: { ...d, qubit: d.qubit - 1 } } as Node)
              : n;
          }),
      };
    }),

  placeGate: (type, qubit, column) =>
    set((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: crypto.randomUUID(),
          type: type === "M" ? "measurement" : "gate",
          position: xyFromCell(qubit, column),
          data: { type, qubit, column } satisfies GateNodeData,
        } as Node,
      ],
    })),

  placeTwoQubitGate: (type, control, target, column) =>
    set((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: crypto.randomUUID(),
          type: "gate",
          position: xyFromCell(target, column),
          data: { type, qubit: target, column, control } satisfies GateNodeData,
        } as Node,
      ],
    })),

  removeSelected: () =>
    set((s) => ({
      nodes: s.nodes.filter((n) => !n.selected),
    })),

  clearCircuit: () =>
    set({ nodes: [], edges: [], results: null, runState: "idle", error: null }),

  // ── runSimulation orchestrator ─────────────────────────────────────────

  runSimulation: async () => {
    const circuitId = crypto.randomUUID();
    const circuit = nodesToCircuitSpec(get().nodes, get().qubitCount);

    // Subscribe BEFORE POSTing to avoid any race condition on fast backends
    const unsub = subscribeToCircuitResult<SimulationResult>(
      circuitId,
      (payload) => {
        set({
          results: payload,
          runState: payload.status === "failed" ? "error" : "success",
        });

        // Open the BottomPanel and focus the probabilities tab
        const shell = useShellStore.getState();
        if (!shell.bottomPanelOpen) shell.toggleBottomPanel();
        shell.setBottomPanelTab("probabilities");

        unsub();
      }
    );

    set({ runState: "running", error: null });

    try {
      await apiFetch(`/api/v1/circuits/${circuitId}/execute`, {
        method: "POST",
        body: JSON.stringify({
          circuit,
          shots: 1024,
          name: get().circuitName,
        }),
        token: useAuthStore.getState().jwt ?? undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ runState: "error", error: message });
      unsub();
    }
  },

  // ── Reset ──────────────────────────────────────────────────────────────

  reset: () =>
    set({
      nodes: [],
      edges: [],
      runState: "idle",
      results: null,
      error: null,
    }),
}));
