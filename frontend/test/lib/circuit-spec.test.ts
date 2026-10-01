import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { GateNodeData } from "@/types";
import {
  nodesToCircuitSpec,
  cellFromXY,
  xyFromCell,
  circuitSpecToQiskitSource,
  GRID,
  circuitSpecToQasm,
  gateRows,
  nextFreeColumn,
  occupiedCells,
  usedColumns,
} from "@/lib/circuit-spec";

// Helper to build a minimal React Flow Node carrying GateNodeData
function makeNode(id: string, data: GateNodeData): Node<GateNodeData> {
  const { x, y } = xyFromCell(data.qubit, data.column);
  return { id, position: { x, y }, data };
}

describe("nodesToCircuitSpec", () => {
  it("converts H + CX + M nodes into the correct CircuitSpec in (column,qubit) order", () => {
    // H at qubit 0, column 0
    const hNode = makeNode("h0", { type: "H", qubit: 0, column: 0 });
    // CX: control qubit 0, target qubit 1, column 1
    const cxNode = makeNode("cx1", { type: "CX", qubit: 1, column: 1, control: 0 });
    // M on qubit 0, column 2
    const m0Node = makeNode("m0", { type: "M", qubit: 0, column: 2 });
    // M on qubit 1, column 2
    const m1Node = makeNode("m1", { type: "M", qubit: 1, column: 2 });

    // Pass nodes in scrambled order to verify sorting
    const spec = nodesToCircuitSpec([m1Node, cxNode, m0Node, hNode], 2);

    expect(spec).toEqual({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: "H", targets: [0] },
        { type: "CX", control: 0, targets: [1] },
        { type: "M", targets: [0], classical: [0] },
        { type: "M", targets: [1], classical: [1] },
      ],
    });
  });

  it("ignores nodes whose data.type is not a valid GateType", () => {
    // A qubit-wire node has no gate type — simulate by casting
    const wireNode = {
      id: "wire0",
      position: { x: 0, y: 0 },
      data: { label: "q0" }, // no 'type' matching GateType
    } as unknown as Node;

    const hNode = makeNode("h0", { type: "H", qubit: 0, column: 0 });
    const spec = nodesToCircuitSpec([wireNode, hNode], 1);

    expect(spec.gates).toHaveLength(1);
    expect(spec.gates[0].type).toBe("H");
  });
});

describe("GRID constants", () => {
  it("has ROW_H, COL_W, ORIGIN_X, ORIGIN_Y as positive numbers", () => {
    expect(GRID.ROW_H).toBeGreaterThan(0);
    expect(GRID.COL_W).toBeGreaterThan(0);
    expect(GRID.ORIGIN_X).toBeGreaterThanOrEqual(0);
    expect(GRID.ORIGIN_Y).toBeGreaterThanOrEqual(0);
  });
});

describe("cellFromXY / xyFromCell round-trip", () => {
  it("cellFromXY(xyFromCell(1,3)) deep-equals { qubit:1, column:3 }", () => {
    const { x, y } = xyFromCell(1, 3);
    expect(cellFromXY(x, y)).toEqual({ qubit: 1, column: 3 });
  });

  it("round-trips for qubit 0, column 0", () => {
    const { x, y } = xyFromCell(0, 0);
    expect(cellFromXY(x, y)).toEqual({ qubit: 0, column: 0 });
  });

  it("round-trips for arbitrary large cell", () => {
    const { x, y } = xyFromCell(5, 10);
    expect(cellFromXY(x, y)).toEqual({ qubit: 5, column: 10 });
  });

  it("cellFromXY clamps negative coordinates to 0", () => {
    const result = cellFromXY(-100, -100);
    expect(result.qubit).toBeGreaterThanOrEqual(0);
    expect(result.column).toBeGreaterThanOrEqual(0);
  });
});

describe("circuitSpecToQiskitSource", () => {
  it("renders a QuantumCircuit constructor line with the right qubit/bit counts", () => {
    const source = circuitSpecToQiskitSource({ qubits: 2, classical_bits: 2, gates: [] });
    expect(source).toContain("qc = QuantumCircuit(2, 2)");
  });

  it("maps single-qubit gates to qc.<method>(target)", () => {
    const source = circuitSpecToQiskitSource({
      qubits: 1,
      classical_bits: 1,
      gates: [{ type: "H", targets: [0] }],
    });
    expect(source).toContain("qc.h(0)");
  });

  it("maps a two-qubit CX gate to qc.cx(control, target)", () => {
    const source = circuitSpecToQiskitSource({
      qubits: 2,
      classical_bits: 2,
      gates: [{ type: "CX", control: 0, targets: [1] }],
    });
    expect(source).toContain("qc.cx(0, 1)");
  });

  it("maps measurement gates to a single qc.measure([...], [...]) line", () => {
    const source = circuitSpecToQiskitSource({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: "M", targets: [0], classical: [0] },
        { type: "M", targets: [1], classical: [1] },
      ],
    });
    expect(source).toContain("qc.measure([0,1], [0,1])");
  });

  it("emits gate lines in the order given, followed by one measure line", () => {
    const source = circuitSpecToQiskitSource({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: "H", targets: [0] },
        { type: "CX", control: 0, targets: [1] },
        { type: "M", targets: [0], classical: [0] },
        { type: "M", targets: [1], classical: [1] },
      ],
    });
    const lines = source.split("\n");
    expect(lines.indexOf("qc.h(0)")).toBeLessThan(lines.indexOf("qc.cx(0, 1)"));
    expect(lines[lines.length - 1]).toBe("qc.measure([0,1], [0,1])");
  });
});

describe("parametric gates and exports", () => {
  const node = (data: Record<string, unknown>, id = String(Math.random())) =>
    ({ id, type: "gate", position: { x: 0, y: 0 }, data }) as never;

  it("nodesToCircuitSpec carries params for parametric gates only", () => {
    const spec = nodesToCircuitSpec(
      [
        node({ type: "RZ", qubit: 0, column: 0, params: { theta: 0.5 } }),
        node({ type: "H", qubit: 1, column: 0, params: { theta: 9 } }),
        node({ type: "RXX", qubit: 1, column: 1, control: 0, params: { theta: 0.25 } }),
      ],
      2
    );
    expect(spec.gates).toEqual([
      { type: "RZ", targets: [0], params: { theta: 0.5 } },
      { type: "H", targets: [1] },
      { type: "RXX", control: 0, targets: [1], params: { theta: 0.25 } },
    ]);
  });

  it("circuitSpecToQasm mirrors the backend mapping", () => {
    const qasm = circuitSpecToQasm({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: "H", targets: [0] },
        { type: "RZ", targets: [0], params: { theta: 0.5 } },
        { type: "U", targets: [1], params: { theta: 1, phi: 2, lambda: 3 } },
        { type: "P", targets: [1], params: { theta: 0.25 } },
        { type: "CX", control: 0, targets: [1] },
        { type: "RYY", control: 0, targets: [1], params: { theta: 0.5 } },
        { type: "M", targets: [0], classical: [0] },
      ],
    });
    expect(qasm.split("\n")).toEqual([
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[2];",
      "creg c[2];",
      "h q[0];",
      "rz(0.5) q[0];",
      "u3(1.0,2.0,3.0) q[1];",
      "u1(0.25) q[1];",
      "cx q[0],q[1];",
      "rx(pi/2) q[0];", "rx(pi/2) q[1];", "cx q[0],q[1];", "rz(0.5) q[1];",
      "cx q[0],q[1];", "rx(-pi/2) q[0];", "rx(-pi/2) q[1];",
      "measure q[0] -> c[0];",
    ]);
  });

  it("circuitSpecToQiskitSource renders parametric and two-qubit gates", () => {
    const src = circuitSpecToQiskitSource({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: "RX", targets: [1], params: { theta: 0.5 } },
        { type: "RZZ", control: 0, targets: [1], params: { theta: 1 } },
        { type: "SX", targets: [0] },
      ],
    });
    expect(src).toContain("qc.rx(0.5, 1)");
    expect(src).toContain("qc.rzz(1.0, 0, 1)");
    expect(src).toContain("qc.sx(0)");
  });

  it("occupancy helpers find the next free column across a gate's span", () => {
    const nodes = [node({ type: "CX", qubit: 2, column: 0, control: 0 }, "a")];
    const occ = occupiedCells(nodes);
    expect(gateRows({ qubit: 2, control: 0 })).toEqual([0, 1, 2]);
    expect(nextFreeColumn(occ, [1])).toBe(1);
    expect(nextFreeColumn(occupiedCells(nodes, new Set(["a"])), [1])).toBe(0);
    expect(usedColumns(nodes)).toBe(1);
  });
});
