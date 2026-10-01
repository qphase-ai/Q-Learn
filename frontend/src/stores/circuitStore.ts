import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import type { GateType, GateNodeData, GateParams, SimulationResult } from "@/types";
import {
  gateRows,
  nextFreeColumn,
  nodesToCircuitSpec,
  occupiedCells,
  xyFromCell,
} from "@/lib/circuit-spec";
import { defaultParams, isGateType, isTwoQubitGate } from "@/lib/gates";
import { subscribeToCircuitResult, getAccessToken } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

export const MIN_QUBITS = 1;
export const MAX_QUBITS = 8;
const HISTORY_LIMIT = 50;

/** Snapshot of the editable circuit, used by undo/redo. */
interface CircuitSnapshot {
  nodes: Node[];
  qubitCount: number;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface CircuitStore {
  // State
  nodes: Node[];
  edges: Edge[];
  circuitName: string;
  qubitCount: number;
  /** Gate "armed" for click/keyboard placement (set from the library or shortcuts). */
  selectedGateType: GateType | null;
  /** Gate currently being dragged out of the library (drop-zone feedback). */
  draggingGateType: GateType | null;
  shots: number;
  runState: "idle" | "running" | "success" | "error";
  results: SimulationResult | null;
  error: string | null;
  past: CircuitSnapshot[];
  future: CircuitSnapshot[];

  // Setters
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedGateType: (type: GateType | null) => void;
  setDraggingGateType: (type: GateType | null) => void;
  setShots: (shots: number) => void;
  setResults: (results: SimulationResult | null) => void;
  setRunState: (state: CircuitStore["runState"]) => void;

  // Circuit-editing actions (all undoable)
  renameCircuit: (name: string) => void;
  addQubit: () => void;
  removeQubit: (index: number) => void;
  setQubitCount: (count: number) => void;
  placeGate: (type: GateType, qubit: number, column: number) => void;
  placeTwoQubitGate: (
    type: GateType,
    control: number,
    target: number,
    column: number
  ) => void;
  /** Place `type` on `qubit` at the first free column (two-qubit gates use qubit+1 as target). */
  placeAtNextFreeColumn: (type: GateType, qubit: number) => void;
  /** Move a gate so its target lands on (qubit, column); a control moves with it. */
  moveGate: (id: string, qubit: number, column: number) => boolean;
  updateGate: (
    id: string,
    patch: { params?: GateParams; qubit?: number; control?: number }
  ) => boolean;
  selectGate: (id: string | null) => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  clearCircuit: () => void;
  undo: () => void;
  redo: () => void;

  // Orchestrator
  runSimulation: () => Promise<void>;

  // Reset
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dataOf = (n: Node) => (n.data as unknown) as GateNodeData;

function makeNode(data: GateNodeData, selected = false): Node {
  return {
    id: crypto.randomUUID(),
    type: data.type === "M" ? "measurement" : "gate",
    position: xyFromCell(data.qubit, data.column),
    data,
    selected,
  } as Node;
}

function withData(n: Node, data: GateNodeData): Node {
  return { ...n, data, position: xyFromCell(data.qubit, data.column) } as Node;
}

/** Positions re-derived from data and selection cleared — what history stores. */
function normalize(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    position: xyFromCell(dataOf(n).qubit, dataOf(n).column),
    selected: false,
    dragging: false,
  })) as Node[];
}

function inRange(rows: number[], qubitCount: number): boolean {
  return rows.every((q) => q >= 0 && q < qubitCount);
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useCircuitStore = create<CircuitStore>((set, get) => {
  /** Push the current circuit onto the undo stack and drop the redo stack. */
  function commit() {
    const { nodes, qubitCount, past } = get();
    set({
      past: [...past, { nodes: normalize(nodes), qubitCount }].slice(-HISTORY_LIMIT),
      future: [],
    });
  }

  function insert(data: GateNodeData) {
    const { nodes } = get();
    const column = nextFreeColumn(occupiedCells(nodes), gateRows(data), data.column);
    commit();
    set({ nodes: [...nodes, makeNode({ ...data, column })] });
  }

  return {
    // ── Initial state ──────────────────────────────────────────────────────
    nodes: [],
    edges: [],
    circuitName: "Untitled Circuit",
    qubitCount: 2,
    selectedGateType: null,
    draggingGateType: null,
    shots: 1024,
    runState: "idle",
    results: null,
    error: null,
    past: [],
    future: [],

    // ── Simple setters ─────────────────────────────────────────────────────
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    setSelectedGateType: (selectedGateType) => set({ selectedGateType }),
    setDraggingGateType: (draggingGateType) => set({ draggingGateType }),
    setShots: (shots) => set({ shots }),
    setResults: (results) => set({ results }),
    setRunState: (runState) => set({ runState }),

    // ── Circuit-editing actions ────────────────────────────────────────────

    renameCircuit: (name) => set({ circuitName: name }),

    addQubit: () => {
      if (get().qubitCount >= MAX_QUBITS) return;
      commit();
      set((s) => ({ qubitCount: s.qubitCount + 1 }));
    },

    removeQubit: (index) => {
      const s = get();
      if (s.qubitCount <= MIN_QUBITS) return;
      commit();
      const shift = (q: number) => (q > index ? q - 1 : q);
      set({
        qubitCount: s.qubitCount - 1,
        nodes: s.nodes
          .filter((n) => {
            const d = dataOf(n);
            return d.qubit !== index && d.control !== index;
          })
          .map((n) => {
            const d = dataOf(n);
            if (d.qubit <= index && (d.control === undefined || d.control <= index)) return n;
            return withData(n, {
              ...d,
              qubit: shift(d.qubit),
              ...(d.control !== undefined ? { control: shift(d.control) } : {}),
            });
          }),
      });
    },

    setQubitCount: (count) => {
      const next = Math.min(MAX_QUBITS, Math.max(MIN_QUBITS, Math.round(count)));
      const s = get();
      if (next === s.qubitCount) return;
      commit();
      set({
        qubitCount: next,
        nodes: s.nodes.filter((n) => inRange(gateRows(dataOf(n)), next)),
      });
    },

    placeGate: (type, qubit, column) =>
      insert({ type, qubit, column, ...(defaultParams(type) ? { params: defaultParams(type) } : {}) }),

    placeTwoQubitGate: (type, control, target, column) =>
      insert({
        type,
        qubit: target,
        column,
        control,
        ...(defaultParams(type) ? { params: defaultParams(type) } : {}),
      }),

    placeAtNextFreeColumn: (type, qubit) => {
      const { qubitCount, placeGate, placeTwoQubitGate } = get();
      if (!isGateType(type)) return;
      if (isTwoQubitGate(type)) {
        if (qubitCount < 2) return;
        const control = Math.min(Math.max(qubit, 0), qubitCount - 2);
        placeTwoQubitGate(type, control, control + 1, 0);
      } else {
        placeGate(type, Math.min(Math.max(qubit, 0), qubitCount - 1), 0);
      }
    },

    moveGate: (id, qubit, column) => {
      const { nodes, qubitCount } = get();
      const node = nodes.find((n) => n.id === id);
      if (!node) return false;
      const d = dataOf(node);
      const delta = qubit - d.qubit;
      const next: GateNodeData = {
        ...d,
        qubit,
        column: Math.max(0, column),
        ...(d.control !== undefined ? { control: d.control + delta } : {}),
      };
      const rows = gateRows(next);
      const blocked = occupiedCells(nodes, new Set([id]));
      const ok = inRange(rows, qubitCount) && rows.every((q) => !blocked.has(`${q}:${next.column}`));
      const unchanged = next.qubit === d.qubit && next.column === d.column;

      if (!ok || unchanged) {
        // Snap back to where the gate was.
        set({ nodes: nodes.map((n) => (n.id === id ? withData(n, d) : n)) });
        return unchanged;
      }
      commit();
      set({ nodes: get().nodes.map((n) => (n.id === id ? withData(n, next) : n)) });
      return true;
    },

    updateGate: (id, patch) => {
      const { nodes, qubitCount } = get();
      const node = nodes.find((n) => n.id === id);
      if (!node) return false;
      const d = dataOf(node);
      const next: GateNodeData = {
        ...d,
        ...(patch.qubit !== undefined ? { qubit: patch.qubit } : {}),
        ...(patch.control !== undefined && d.control !== undefined ? { control: patch.control } : {}),
        ...(patch.params ? { params: { ...d.params, ...patch.params } } : {}),
      };
      if (next.control !== undefined && next.control === next.qubit) return false;
      const rows = gateRows(next);
      if (!inRange(rows, qubitCount)) return false;
      const blocked = occupiedCells(nodes, new Set([id]));
      if (rows.some((q) => blocked.has(`${q}:${next.column}`))) {
        next.column = nextFreeColumn(blocked, rows, next.column);
      }
      commit();
      set({ nodes: get().nodes.map((n) => (n.id === id ? withData(n, next) : n)) });
      return true;
    },

    selectGate: (id) =>
      set((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })) as Node[] })),

    duplicateSelected: () => {
      const { nodes } = get();
      const selected = nodes.filter((n) => n.selected);
      if (selected.length === 0) return;
      commit();
      const occupied = occupiedCells(nodes);
      const copies = selected.map((n) => {
        const d = dataOf(n);
        const rows = gateRows(d);
        const column = nextFreeColumn(occupied, rows, d.column + 1);
        rows.forEach((q) => occupied.add(`${q}:${column}`));
        return makeNode({ ...d, ...(d.params ? { params: { ...d.params } } : {}), column }, true);
      });
      set({
        nodes: [...nodes.map((n) => ({ ...n, selected: false }) as Node), ...copies],
      });
    },

    removeSelected: () => {
      const { nodes } = get();
      if (!nodes.some((n) => n.selected)) return;
      commit();
      set({ nodes: nodes.filter((n) => !n.selected) });
    },

    clearCircuit: () => {
      if (get().nodes.length > 0) commit();
      set({ nodes: [], edges: [], results: null, runState: "idle", error: null });
    },

    undo: () => {
      const { past, future, nodes, qubitCount } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({
        past: past.slice(0, -1),
        future: [{ nodes: normalize(nodes), qubitCount }, ...future].slice(0, HISTORY_LIMIT),
        nodes: prev.nodes,
        qubitCount: prev.qubitCount,
      });
    },

    redo: () => {
      const { past, future, nodes, qubitCount } = get();
      const next = future[0];
      if (!next) return;
      set({
        past: [...past, { nodes: normalize(nodes), qubitCount }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        nodes: next.nodes,
        qubitCount: next.qubitCount,
      });
    },

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

          unsub();
        }
      );

      set({ runState: "running", error: null });

      try {
        await apiFetch(`/api/v1/circuits/${circuitId}/execute`, {
          method: "POST",
          body: JSON.stringify({
            circuit,
            shots: get().shots,
            name: get().circuitName,
          }),
          token: (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined,
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
        past: [],
        future: [],
        selectedGateType: null,
        draggingGateType: null,
      }),
  };
});
