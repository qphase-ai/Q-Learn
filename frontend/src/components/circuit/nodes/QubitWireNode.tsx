"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { GRID } from "@/lib/circuit-spec";
import { getGate } from "@/lib/gates";
import { useCircuitStore } from "@/stores/circuitStore";
import { GATE_SEARCH_ID } from "@/components/circuit/library/GateLibrary";

export interface QubitWireData extends Record<string, unknown> {
  index: number;
  /** Total wire width in px (grows with the circuit). */
  width: number;
  /** x (node-relative) of the add-operation zone: the first column after the last gate. */
  addX: number;
}

/** Wire start (x) relative to the node — just right of the "q₀ |0⟩" label. */
export const WIRE_START = 76;

function QubitWireNode({ data }: NodeProps) {
  const { index, width, addX } = data as unknown as QubitWireData;
  const armed = useCircuitStore((s) => s.selectedGateType);
  const placeAtNextFreeColumn = useCircuitStore((s) => s.placeAtNextFreeColumn);
  const setSelectedGateType = useCircuitStore((s) => s.setSelectedGateType);

  function handleAdd() {
    if (armed) {
      placeAtNextFreeColumn(armed, index);
      setSelectedGateType(null);
    } else {
      document.getElementById(GATE_SEARCH_ID)?.focus();
    }
  }

  const addLabel = armed
    ? `Append ${getGate(armed).name} to q${index}`
    : `Add a gate to q${index} — choose one from the library`;

  return (
    <div
      className="relative select-none"
      style={{ width, height: GRID.GATE, pointerEvents: "none" }}
    >
      {/* Label: q₀ |0⟩ */}
      <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-baseline gap-1.5 whitespace-nowrap font-mono text-[13px]">
        <span className="font-semibold italic text-foreground">
          q<sub className="text-[10px] not-italic">{index}</sub>
        </span>
        <span className="text-muted-foreground">|0⟩</span>
      </div>

      {/* Wire */}
      <div
        className="absolute top-1/2 h-px -translate-y-1/2 bg-[color:var(--wire)] opacity-70"
        style={{ left: WIRE_START, right: 0 }}
      />

      {/* Add-operation zone */}
      <button
        type="button"
        onClick={handleAdd}
        aria-label={addLabel}
        title={addLabel}
        className="nodrag nopan absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-dashed border-overlay/15 bg-surface text-muted-foreground outline-none transition-colors hover:border-cyber-cyan/60 hover:text-cyber-cyan focus-visible:ring-2 focus-visible:ring-cyber-cyan/70"
        style={{ left: addX, pointerEvents: "auto" }}
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}

export default memo(QubitWireNode);
