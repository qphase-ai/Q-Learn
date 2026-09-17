"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCircuitStore } from "@/stores/circuitStore";
import { GRID, cellFromXY } from "@/lib/circuit-spec";
import type { GateType } from "@/types";

import QubitWireNode from "@/components/circuit/nodes/QubitWireNode";
import GateNode from "@/components/circuit/nodes/GateNode";
import MeasurementNode from "@/components/circuit/nodes/MeasurementNode";

// Define nodeTypes outside the component to keep referential stability.
const nodeTypes = {
  qubit: QubitWireNode,
  gate: GateNode,
  measurement: MeasurementNode,
};

const TWO_QUBIT_GATES = new Set<GateType>(["CX", "CZ", "SWAP"]);

function CircuitCanvasInner() {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const selectedGateType = useCircuitStore((s) => s.selectedGateType);

  const setNodes = useCircuitStore((s) => s.setNodes);
  const setEdges = useCircuitStore((s) => s.setEdges);
  const placeGate = useCircuitStore((s) => s.placeGate);
  const placeTwoQubitGate = useCircuitStore((s) => s.placeTwoQubitGate);

  const { screenToFlowPosition } = useReactFlow();

  // Wire lanes are ephemeral — derived from qubitCount, not stored.
  const wireNodes: Node[] = useMemo(
    () =>
      Array.from({ length: qubitCount }, (_, i) => ({
        id: `wire-${i}`,
        type: "qubit" as const,
        position: { x: 0, y: GRID.ORIGIN_Y + i * GRID.ROW_H },
        data: { index: i },
        draggable: false,
        selectable: false,
      })),
    [qubitCount]
  );

  const allNodes = useMemo(
    () => [...wireNodes, ...nodes],
    [wireNodes, nodes]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Drop changes that target wire nodes — they are ephemeral.
      const storeChanges = changes.filter(
        (c) => !("id" in c && typeof c.id === "string" && c.id.startsWith("wire-"))
      );
      const result = applyNodeChanges(storeChanges, nodes);
      setNodes(result);
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      const type =
        (e.dataTransfer.getData("application/gate-type") as GateType) ||
        selectedGateType;

      if (!type) return;

      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const { qubit: rawQubit, column } = cellFromXY(pos.x, pos.y);
      const qubit = Math.min(Math.max(rawQubit, 0), qubitCount - 1);

      if (TWO_QUBIT_GATES.has(type)) {
        // Slice-1 rule: control=q clamped so target fits.
        const control = Math.min(qubit, qubitCount - 2);
        placeTwoQubitGate(type, control, control + 1, column);
      } else {
        placeGate(type, qubit, column);
      }
    },
    [selectedGateType, qubitCount, screenToFlowPosition, placeGate, placeTwoQubitGate]
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView={false}
        style={{ background: "var(--bg-base)" }}
      >
        <Background color="var(--border)" gap={GRID.COL_W} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function CircuitCanvas() {
  return (
    <ReactFlowProvider>
      <CircuitCanvasInner />
    </ReactFlowProvider>
  );
}
