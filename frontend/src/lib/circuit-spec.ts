import type { Node } from "@xyflow/react";
import type { GateNodeData, GateSpec, GateType, CircuitSpec } from "@/types";

// ---------------------------------------------------------------------------
// Grid constants — pixel geometry for the snapped-grid circuit canvas
// ---------------------------------------------------------------------------
export const GRID = {
  ROW_H: 64,    // vertical spacing between qubit rows (px)
  COL_W: 72,    // horizontal spacing between gate columns (px)
  ORIGIN_X: 24, // x offset of column 0
  ORIGIN_Y: 24, // y offset of qubit row 0
} as const;

// ---------------------------------------------------------------------------
// Cell ↔ pixel conversions
// ---------------------------------------------------------------------------

/** Convert a (qubit, column) grid cell to a React Flow {x, y} position. */
export function xyFromCell(qubit: number, column: number): { x: number; y: number } {
  return {
    x: GRID.ORIGIN_X + column * GRID.COL_W,
    y: GRID.ORIGIN_Y + qubit * GRID.ROW_H,
  };
}

/**
 * Convert a React Flow {x, y} position back to a (qubit, column) grid cell.
 * Uses Math.round for nearest-cell snapping; results are clamped to ≥ 0.
 */
export function cellFromXY(x: number, y: number): { qubit: number; column: number } {
  return {
    qubit: Math.max(0, Math.round((y - GRID.ORIGIN_Y) / GRID.ROW_H)),
    column: Math.max(0, Math.round((x - GRID.ORIGIN_X) / GRID.COL_W)),
  };
}

// ---------------------------------------------------------------------------
// Known gate types set — used to filter out non-gate nodes
// ---------------------------------------------------------------------------
const GATE_TYPES = new Set<GateType>([
  "H", "X", "Y", "Z", "S", "T", "I", "CX", "CZ", "SWAP", "M",
]);

const TWO_QUBIT_GATES = new Set<GateType>(["CX", "CZ", "SWAP"]);

function isGateType(value: unknown): value is GateType {
  return typeof value === "string" && GATE_TYPES.has(value as GateType);
}

// ---------------------------------------------------------------------------
// Main serializer: React Flow nodes → CircuitSpec
// ---------------------------------------------------------------------------

/**
 * Convert an array of React Flow nodes to a backend `CircuitSpec`.
 *
 * - Only nodes whose `data.type` is a recognized `GateType` are included;
 *   qubit-wire or other auxiliary nodes are silently skipped.
 * - Gates are sorted by (column, qubit) ascending before mapping.
 * - Mapping rules:
 *   - "M"  → { type:"M", targets:[qubit], classical:[qubit] }
 *   - Two-qubit ("CX"|"CZ"|"SWAP") → { type, control:data.control, targets:[qubit] }
 *   - Single-qubit (all others) → { type, targets:[qubit] }
 */
export function nodesToCircuitSpec(
  nodes: Node[],
  qubitCount: number,
): CircuitSpec {
  // Filter to gate nodes only
  const gateNodes = nodes.filter((n): n is Node<GateNodeData> =>
    isGateType((n.data as Record<string, unknown>)?.type),
  );

  // Sort by (column, qubit)
  gateNodes.sort((a, b) => {
    const da = a.data as GateNodeData;
    const db = b.data as GateNodeData;
    if (da.column !== db.column) return da.column - db.column;
    return da.qubit - db.qubit;
  });

  // Map to GateSpec
  const gates: GateSpec[] = gateNodes.map((n) => {
    const d = n.data as GateNodeData;
    if (d.type === "M") {
      return { type: "M", targets: [d.qubit], classical: [d.qubit] };
    }
    if (TWO_QUBIT_GATES.has(d.type)) {
      return { type: d.type, control: d.control, targets: [d.qubit] };
    }
    return { type: d.type, targets: [d.qubit] };
  });

  return {
    qubits: qubitCount,
    classical_bits: qubitCount,
    gates,
  };
}

// ---------------------------------------------------------------------------
// Qiskit code generation: CircuitSpec → runnable Qiskit Python
// ---------------------------------------------------------------------------

// Single-qubit gate type → Qiskit method name.
const SINGLE_QUBIT_METHODS: Record<string, string> = {
  H: "h",
  X: "x",
  Y: "y",
  Z: "z",
  S: "s",
  T: "t",
  I: "id",
};

// Two-qubit gate type → Qiskit method name (called as qc.method(control, target)).
const TWO_QUBIT_METHODS: Record<string, string> = {
  CX: "cx",
  CZ: "cz",
  SWAP: "swap",
};

/**
 * Generate runnable Qiskit Python for a `CircuitSpec`. This is a deterministic
 * translation of the circuit the student has actually built — not sample code.
 * The output mirrors the panel shown in the reference: build the circuit, apply
 * each gate in order, measure, then run on the Aer simulator.
 */
export function specToQiskit(spec: CircuitSpec, name = "Untitled"): string {
  const lines: string[] = [];
  const safeName = name.trim() || "Untitled";

  lines.push("from qiskit import QuantumCircuit");
  lines.push("from qiskit_aer import AerSimulator");
  lines.push("");
  lines.push(`# ${safeName} — ${spec.qubits}-qubit circuit`);
  lines.push(
    `qc = QuantumCircuit(${spec.qubits}, ${spec.classical_bits || spec.qubits})`
  );
  lines.push("");

  if (spec.gates.length === 0) {
    lines.push("# (add gates in the circuit builder to generate operations)");
  }

  for (const gate of spec.gates) {
    const target = gate.targets[0];
    if (gate.type === "M") {
      const classical = gate.classical?.[0] ?? target;
      lines.push(`qc.measure(${target}, ${classical})`);
    } else if (TWO_QUBIT_METHODS[gate.type] !== undefined) {
      const method = TWO_QUBIT_METHODS[gate.type];
      const control = gate.control ?? target;
      lines.push(`qc.${method}(${control}, ${target})`);
    } else if (SINGLE_QUBIT_METHODS[gate.type] !== undefined) {
      lines.push(`qc.${SINGLE_QUBIT_METHODS[gate.type]}(${target})`);
    } else {
      lines.push(`# unsupported gate: ${gate.type}`);
    }
  }

  lines.push("");
  lines.push("# Execute on the Aer simulator");
  lines.push("simulator = AerSimulator()");
  lines.push("result = simulator.run(qc, shots=1024).result()");
  lines.push("counts = result.get_counts()");
  lines.push("print(counts)");

  return lines.join("\n");
}
