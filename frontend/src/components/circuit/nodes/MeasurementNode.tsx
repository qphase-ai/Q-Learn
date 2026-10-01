"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useCircuitStore } from "@/stores/circuitStore";
import { GRID } from "@/lib/circuit-spec";
import { cn } from "@/lib/utils";
import GateGlyph from "@/components/circuit/GateGlyph";
import type { GateNodeData } from "@/types";

/**
 * Measurement: the meter glyph on the qubit plus a dashed classical line down
 * to the bit it writes on the classical register.
 */
function MeasurementNode({ data, selected }: NodeProps) {
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const isRunning = useCircuitStore((s) => s.runState === "running");
  const { qubit, column } = data as GateNodeData;
  // Distance from this node's top to the classical register's centre line.
  const cy = (qubitCount - qubit) * GRID.ROW_H + GRID.GATE / 2;
  const label = `Measure q${qubit} into c[${qubit}], column ${column + 1}`;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "relative cursor-pointer transition-[filter] duration-150 hover:brightness-110",
        isRunning && "motion-safe:animate-pulse"
      )}
      style={{ width: GRID.GATE, height: GRID.GATE }}
    >
      <div
        aria-hidden
        className="absolute border-l-2 border-dashed border-[color:var(--gate-meas)] opacity-70"
        style={{ left: GRID.GATE / 2 - 1, top: GRID.GATE, height: cy - GRID.GATE - 10 }}
      />
      <div
        aria-hidden
        className="absolute flex items-center justify-center rounded-md border border-[color:var(--gate-meas)] bg-surface font-mono text-[10px] font-semibold text-foreground"
        style={{ left: GRID.GATE / 2 - 10, top: cy - 10, width: 20, height: 20 }}
      >
        {qubit}
      </div>
      <GateGlyph type="M" size={GRID.GATE} selected={selected} />
    </div>
  );
}

export default memo(MeasurementNode);
