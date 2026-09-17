import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import type { GateNodeData } from "@/types";
import {
  nodesToCircuitSpec,
  cellFromXY,
  xyFromCell,
  GRID,
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
