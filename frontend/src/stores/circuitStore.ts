import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";

interface SimulationResult {
  probabilities: Record<string, number>;
  statevector: number[] | null;
  measurements: Record<string, number>;
  execution_time_ms: number;
}

interface CircuitStore {
  nodes: Node[];
  edges: Edge[];
  runState: "idle" | "running" | "completed" | "error";
  results: SimulationResult | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setRunState: (state: CircuitStore["runState"]) => void;
  setResults: (results: SimulationResult | null) => void;
  reset: () => void;
}

export const useCircuitStore = create<CircuitStore>((set) => ({
  nodes: [],
  edges: [],
  runState: "idle",
  results: null,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setRunState: (runState) => set({ runState }),
  setResults: (results) => set({ results }),
  reset: () => set({ nodes: [], edges: [], runState: "idle", results: null }),
}));
