"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GRID } from "@/lib/circuit-spec";
import { WIRE_START } from "@/components/circuit/nodes/QubitWireNode";

export interface ClassicalWireData extends Record<string, unknown> {
  bits: number;
  width: number;
}

/** The classical register: a double line labelled "c" with its bit width. */
function ClassicalWireNode({ data }: NodeProps) {
  const { bits, width } = data as unknown as ClassicalWireData;
  return (
    <div
      className="relative select-none"
      style={{ width, height: GRID.GATE, pointerEvents: "none" }}
      aria-hidden
    >
      <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-baseline gap-1 font-mono text-[13px]">
        <span className="font-semibold italic text-foreground">c</span>
        <span className="text-[10px] text-muted-foreground">{bits} bit{bits === 1 ? "" : "s"}</span>
      </div>
      <div
        className="absolute top-1/2 h-[5px] -translate-y-1/2 border-y border-[color:var(--wire)] opacity-50"
        style={{ left: WIRE_START, right: 0 }}
      />
      {/* Register-width slash */}
      <div
        className="absolute top-1/2 h-3 w-px -translate-y-1/2 rotate-[30deg] bg-[color:var(--wire)] opacity-70"
        style={{ left: WIRE_START + 10 }}
      />
    </div>
  );
}

export default memo(ClassicalWireNode);
