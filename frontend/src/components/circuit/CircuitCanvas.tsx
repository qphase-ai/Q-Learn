"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  PanOnScrollMode,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCircuitStore } from "@/stores/circuitStore";
import {
  GRID,
  cellFromXY,
  nextFreeColumn,
  occupiedCells,
  usedColumns,
} from "@/lib/circuit-spec";
import { getGate, isGateType, isTwoQubitGate } from "@/lib/gates";
import type { GateType } from "@/types";

import QubitWireNode from "@/components/circuit/nodes/QubitWireNode";
import ClassicalWireNode from "@/components/circuit/nodes/ClassicalWireNode";
import CellGridNode, { type DropPreview } from "@/components/circuit/nodes/CellGridNode";
import GateNode from "@/components/circuit/nodes/GateNode";
import MeasurementNode from "@/components/circuit/nodes/MeasurementNode";
import GateGlyph from "@/components/circuit/GateGlyph";
import { GATE_DRAG_MIME } from "@/components/circuit/library/GateCard";

// Define nodeTypes outside the component to keep referential stability.
const nodeTypes = {
  qubit: QubitWireNode,
  classical: ClassicalWireNode,
  cells: CellGridNode,
  gate: GateNode,
  measurement: MeasurementNode,
};

const MIN_COLS = 10;
const EXTRA_COLS = 3;
const ADD_ZONE = 56; // room after the last column for the "+" buttons
const MIN_HEIGHT = 400;

/** Canvas height that fits every qubit row plus the classical register. */
export function canvasHeight(qubitCount: number): number {
  return Math.max(MIN_HEIGHT, GRID.ORIGIN_Y + (qubitCount + 1) * GRID.ROW_H + 8);
}

/** Rows a gate dropped/clicked on `qubit` will occupy (target last). */
function rowsFor(type: GateType, qubit: number, qubitCount: number): number[] | null {
  if (!isTwoQubitGate(type)) return [qubit];
  if (qubitCount < 2) return null;
  const control = Math.min(qubit, qubitCount - 2);
  return [control, control + 1];
}

function CircuitCanvasInner() {
  const nodes = useCircuitStore((s) => s.nodes);
  const edges = useCircuitStore((s) => s.edges);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const armed = useCircuitStore((s) => s.selectedGateType);
  const draggingGateType = useCircuitStore((s) => s.draggingGateType);

  const setNodes = useCircuitStore((s) => s.setNodes);
  const setEdges = useCircuitStore((s) => s.setEdges);
  const placeGate = useCircuitStore((s) => s.placeGate);
  const placeTwoQubitGate = useCircuitStore((s) => s.placeTwoQubitGate);
  const moveGate = useCircuitStore((s) => s.moveGate);
  const setSelectedGateType = useCircuitStore((s) => s.setSelectedGateType);
  const setDraggingGateType = useCircuitStore((s) => s.setDraggingGateType);

  const { screenToFlowPosition } = useReactFlow();
  const [preview, setPreview] = useState<DropPreview | null>(null);

  // A library drag that ends outside the canvas leaves no preview behind.
  useEffect(() => {
    if (!draggingGateType) setPreview(null);
  }, [draggingGateType]);

  const occupied = useMemo(() => occupiedCells(nodes), [nodes]);
  const cols = Math.max(MIN_COLS, usedColumns(nodes) + EXTRA_COLS);
  const width = GRID.ORIGIN_X + cols * GRID.COL_W + ADD_ZONE;
  const height = canvasHeight(qubitCount);

  /** Where a gate of `type` aimed at (qubit, column) will actually land. */
  const resolve = useCallback(
    (type: GateType, qubit: number, column: number): DropPreview => {
      const inside = qubit >= 0 && qubit < qubitCount;
      const rows = inside ? rowsFor(type, qubit, qubitCount) : null;
      if (!rows) return { type, rows: [Math.min(Math.max(qubit, 0), qubitCount - 1)], column, valid: false };
      return { type, rows, column: nextFreeColumn(occupied, rows, column), valid: true };
    },
    [occupied, qubitCount]
  );

  const place = useCallback(
    (type: GateType, qubit: number, column: number) => {
      const target = resolve(type, qubit, column);
      if (!target.valid) return;
      if (target.rows.length === 2) {
        placeTwoQubitGate(type, target.rows[0], target.rows[1], target.column);
      } else {
        placeGate(type, target.rows[0], target.column);
      }
    },
    [resolve, placeGate, placeTwoQubitGate]
  );

  const onPlaceCell = useCallback(
    (qubit: number, column: number) => {
      if (!armed) return;
      place(armed, qubit, column);
      setSelectedGateType(null);
    },
    [armed, place, setSelectedGateType]
  );

  // Wires, register and grid are ephemeral — derived from qubitCount, not
  // stored. Their dimension changes are filtered out of the store below, so
  // they carry explicit width/height or React Flow would keep them hidden.
  const frameNodes: Node[] = useMemo(
    () => [
      {
        id: "cells",
        type: "cells",
        position: { x: 0, y: 0 },
        data: { cols, qubitCount, occupied, armed, preview, onPlace: onPlaceCell },
        width,
        height,
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: 1,
      },
      ...Array.from({ length: qubitCount }, (_, i) => ({
        id: `wire-${i}`,
        type: "qubit" as const,
        position: { x: 0, y: GRID.ORIGIN_Y + i * GRID.ROW_H },
        data: { index: i, width, addX: GRID.ORIGIN_X + usedColumns(nodes) * GRID.COL_W + (GRID.GATE - 32) / 2 },
        width,
        height: GRID.GATE,
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: 0,
      })),
      {
        id: "wire-classical",
        type: "classical",
        position: { x: 0, y: GRID.ORIGIN_Y + qubitCount * GRID.ROW_H },
        data: { bits: qubitCount, width },
        width,
        height: GRID.GATE,
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: 0,
      },
    ],
    [cols, qubitCount, occupied, armed, preview, onPlaceCell, width, height, nodes]
  );

  const allNodes = useMemo(
    () => [...frameNodes, ...nodes.map((n) => ({ ...n, zIndex: n.selected ? 3 : 2 }))],
    [frameNodes, nodes]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Drop changes that target frame nodes — they are ephemeral.
      const storeChanges = changes.filter(
        (c) =>
          !("id" in c && typeof c.id === "string" && (c.id.startsWith("wire-") || c.id === "cells"))
      );
      const removed = storeChanges.filter((c) => c.type === "remove");
      if (removed.length > 0) {
        // Route deletions through the store so they are undoable.
        const ids = new Set(removed.map((c) => (c as { id: string }).id));
        useCircuitStore.getState().selectGate(null);
        setNodes(nodes.map((n) => ({ ...n, selected: ids.has(n.id) })));
        useCircuitStore.getState().removeSelected();
        return;
      }
      setNodes(applyNodeChanges(storeChanges, nodes));
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      if (!isGateType((node.data as { type?: unknown })?.type)) return;
      const { qubit, column } = cellFromXY(node.position.x, node.position.y);
      moveGate(node.id, qubit, column);
    },
    [moveGate]
  );

  const cellAt = useCallback(
    (e: React.DragEvent | React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      return {
        qubit: Math.floor((pos.y - GRID.ORIGIN_Y + (GRID.ROW_H - GRID.GATE) / 2) / GRID.ROW_H),
        column: Math.max(
          0,
          Math.floor((pos.x - GRID.ORIGIN_X + (GRID.COL_W - GRID.GATE) / 2) / GRID.COL_W)
        ),
      };
    },
    [screenToFlowPosition]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const type = draggingGateType ?? armed;
      if (!type) return;
      const { qubit, column } = cellAt(e);
      const next = resolve(type, qubit, column);
      setPreview((prev) =>
        prev &&
        prev.type === next.type &&
        prev.column === next.column &&
        prev.valid === next.valid &&
        prev.rows.join() === next.rows.join()
          ? prev
          : next
      );
    },
    [draggingGateType, armed, cellAt, resolve]
  );

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setPreview(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setPreview(null);
      setDraggingGateType(null);

      const raw = e.dataTransfer.getData(GATE_DRAG_MIME) || e.dataTransfer.getData("application/gate-type");
      const type = (isGateType(raw) ? raw : null) ?? armed;
      if (!type) return;

      // Same raw row as the drag-over preview: a drop it showed as invalid
      // (e.g. over the classical register) places nothing.
      const { qubit, column } = cellAt(e);
      place(type, qubit, column);
    },
    [armed, cellAt, place, setDraggingGateType]
  );

  const empty = nodes.length === 0 && !preview;

  return (
    <div
      className="relative w-full"
      style={{ height }}
      onDragLeave={onDragLeave}
      data-testid="circuit-canvas"
    >
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneClick={() => useCircuitStore.getState().selectGate(null)}
        fitView={false}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={1}
        maxZoom={1}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Horizontal}
        preventScrolling={false}
        translateExtent={[
          [-16, 0],
          [width + 16, height],
        ]}
        nodeExtent={[
          [0, 0],
          [width, height],
        ]}
        deleteKeyCode={["Delete", "Backspace"]}
        proOptions={{ hideAttribution: true }}
        aria-label="Quantum circuit canvas"
        style={{ background: "transparent" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="hsl(var(--overlay) / 0.12)"
        />
      </ReactFlow>

      {empty && (
        <div
          className="pointer-events-none absolute inset-y-0 flex items-center justify-center"
          style={{ left: GRID.ORIGIN_X, right: ADD_ZONE }}
        >
          <div className="flex flex-col items-center gap-2 rounded-xl border border-overlay/10 bg-surface/80 px-5 py-4 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-foreground">Build your quantum circuit</p>
            <p className="text-xs text-muted-foreground">
              {armed
                ? `Click a cell to place ${getGate(armed).name}.`
                : "Drag a gate from the library onto a qubit."}
            </p>
            <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground" aria-hidden>
              <GateGlyph type={armed ?? "H"} size={26} showParam={false} />
              <span>→</span>
              <span className="italic text-foreground">
                q<sub>0</sub>
              </span>
            </div>
          </div>
        </div>
      )}
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
