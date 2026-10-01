import type { Node } from "@xyflow/react";
import type { GateNodeData, GateSpec, GateType, CircuitSpec } from "@/types";
import { GATES, isGateType, isTwoQubitGate } from "@/lib/gates";

// ---------------------------------------------------------------------------
// Grid constants — pixel geometry for the snapped-grid circuit canvas
// ---------------------------------------------------------------------------
export const GRID = {
  ROW_H: 64,     // vertical spacing between qubit rows (px)
  COL_W: 64,     // horizontal spacing between gate columns (px)
  ORIGIN_X: 104, // x offset of column 0 (leaves a gutter for "q₀ |0⟩" labels)
  ORIGIN_Y: 44,  // y offset of qubit row 0 (leaves room for column indices)
  GATE: 44,      // gate body size (px); wires run through its vertical centre
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
// Occupancy — which (qubit, column) cells a gate covers
// ---------------------------------------------------------------------------

/** Every qubit row a gate spans (two-qubit gates also block the rows between). */
export function gateRows(d: Pick<GateNodeData, "qubit" | "control">): number[] {
  if (d.control === undefined) return [d.qubit];
  const lo = Math.min(d.qubit, d.control);
  const hi = Math.max(d.qubit, d.control);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** Set of "qubit:column" keys covered by gates, optionally ignoring some node ids. */
export function occupiedCells(nodes: Node[], ignore: ReadonlySet<string> = new Set()): Set<string> {
  const cells = new Set<string>();
  for (const n of nodes) {
    if (ignore.has(n.id)) continue;
    const d = n.data as GateNodeData;
    if (!isGateType(d?.type)) continue;
    for (const q of gateRows(d)) cells.add(`${q}:${d.column}`);
  }
  return cells;
}

/** First column ≥ `from` where every row in `rows` is free. */
export function nextFreeColumn(occupied: Set<string>, rows: number[], from = 0): number {
  let col = Math.max(0, from);
  while (rows.some((q) => occupied.has(`${q}:${col}`))) col++;
  return col;
}

/** Number of columns in use (highest occupied column + 1). */
export function usedColumns(nodes: Node[]): number {
  let max = -1;
  for (const n of nodes) {
    const d = n.data as GateNodeData;
    if (isGateType(d?.type)) max = Math.max(max, d.column);
  }
  return max + 1;
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
 *   - Two-qubit (CX, CZ, SWAP, RXX, RYY, RZZ) → { type, control:data.control, targets:[qubit] }
 *   - Single-qubit (all others) → { type, targets:[qubit] }
 *   - Parametric gates additionally carry `params` ({ theta, phi?, lambda? } in radians)
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
    const params = d.params && GATES[d.type].params.length > 0 ? { params: { ...d.params } } : {};
    if (isTwoQubitGate(d.type)) {
      return { type: d.type, control: d.control, targets: [d.qubit], ...params };
    }
    return { type: d.type, targets: [d.qubit], ...params };
  });

  return {
    qubits: qubitCount,
    classical_bits: qubitCount,
    gates,
  };
}

// ---------------------------------------------------------------------------
// CircuitSpec → illustrative Qiskit source (for the dashboard's read-only
// "Circuit Code" panel — the backend only returns QASM, not Python source).
// ---------------------------------------------------------------------------

const QISKIT_METHOD: Record<Exclude<GateType, "M">, string> = {
  H: "h", X: "x", Y: "y", Z: "z", S: "s", T: "t", I: "id",
  RX: "rx", RY: "ry", RZ: "rz", U: "u", U3: "u", P: "p", SX: "sx",
  CX: "cx", CZ: "cz", SWAP: "swap", RXX: "rxx", RYY: "ryy", RZZ: "rzz",
};

/** Ordered numeric parameters for a gate spec (θ, φ, λ as the gate defines them). */
function paramValues(gate: GateSpec): number[] {
  const def = GATES[gate.type as GateType];
  if (!def) return [];
  const params = (gate.params ?? {}) as Record<string, unknown>;
  return def.params.map((p) => {
    const v = params[p.key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  });
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? v.toFixed(1) : String(Number(v.toPrecision(12)));
}

/** Render a `CircuitSpec` as illustrative Qiskit Python source. Pure/deterministic. */
export function circuitSpecToQiskitSource(spec: CircuitSpec): string {
  const lines: string[] = [
    "from qiskit import QuantumCircuit",
    "from qiskit_aer import AerSimulator",
    "",
    `qc = QuantumCircuit(${spec.qubits}, ${spec.classical_bits})`,
  ];

  const measureTargets: number[] = [];

  for (const gate of spec.gates) {
    const target = gate.targets[0];
    if (gate.type === "M") {
      measureTargets.push(...gate.targets);
      continue;
    }
    const method = QISKIT_METHOD[gate.type as Exclude<GateType, "M">];
    if (!method) continue;
    const args = paramValues(gate).map(fmtNum);
    const qubits = gate.control !== undefined ? [gate.control, target] : [target];
    lines.push(`qc.${method}(${[...args, ...qubits].join(", ")})`);
  }

  if (measureTargets.length > 0) {
    lines.push(`qc.measure(${JSON.stringify(measureTargets)}, ${JSON.stringify(measureTargets)})`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CircuitSpec → OpenQASM 2.0 (Export menu). Mirrors the backend's
// `QiskitAerAdapter._spec_to_qasm` so exported files run the same circuit.
// ---------------------------------------------------------------------------

const QASM_OP: Record<Exclude<GateType, "M" | "RYY">, string> = {
  H: "h", X: "x", Y: "y", Z: "z", S: "s", T: "t", I: "id",
  RX: "rx", RY: "ry", RZ: "rz", U: "u3", U3: "u3", P: "u1", SX: "sx",
  CX: "cx", CZ: "cz", SWAP: "swap", RXX: "rxx", RZZ: "rzz",
};

export function circuitSpecToQasm(spec: CircuitSpec): string {
  const lines = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    `qreg q[${spec.qubits}];`,
    `creg c[${spec.classical_bits}];`,
  ];
  for (const gate of spec.gates) {
    const t = gate.targets[0];
    if (gate.type === "M") {
      gate.targets.forEach((q, i) => {
        lines.push(`measure q[${q}] -> c[${gate.classical?.[i] ?? q}];`);
      });
      continue;
    }
    const args = paramValues(gate).map(fmtNum);
    if (gate.type === "RYY") {
      // ryy is not in qelib1.inc — standard decomposition.
      const a = `q[${gate.control ?? t}]`;
      const b = `q[${t}]`;
      lines.push(
        `rx(pi/2) ${a};`, `rx(pi/2) ${b};`, `cx ${a},${b};`, `rz(${args[0]}) ${b};`,
        `cx ${a},${b};`, `rx(-pi/2) ${a};`, `rx(-pi/2) ${b};`
      );
      continue;
    }
    const base = QASM_OP[gate.type as keyof typeof QASM_OP];
    if (!base) continue;
    const op = args.length > 0 ? `${base}(${args.join(",")})` : base;
    const qargs = gate.control !== undefined ? `q[${gate.control}],q[${t}]` : `q[${t}]`;
    lines.push(`${op} ${qargs};`);
  }
  return lines.join("\n");
}
