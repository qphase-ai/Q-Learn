"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useCircuitStore } from "@/stores/circuitStore";
import { GRID } from "@/lib/circuit-spec";
import { formatAngle, getGate } from "@/lib/gates";
import { cn } from "@/lib/utils";
import GateGlyph from "@/components/circuit/GateGlyph";
import type { GateNodeData } from "@/types";

const C = GRID.GATE / 2; // centre of the node's own cell

function ControlDot({ dy, color }: { dy: number; color: string }) {
  return (
    <div
      className="absolute rounded-full"
      style={{ left: C - 6, top: C + dy - 6, width: 12, height: 12, background: color }}
    />
  );
}

function SwapCross({ dy, color }: { dy: number; color: string }) {
  return (
    <svg
      className="absolute"
      style={{ left: C - 8, top: C + dy - 8 }}
      width={16}
      height={16}
      viewBox="0 0 16 16"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 2l12 12M14 2L2 14" />
    </svg>
  );
}

/**
 * A placed gate. The node sits on its target cell; two-qubit gates draw the
 * control (or partner) qubit and the vertical connector relative to it.
 */
function GateNode({ data, selected }: NodeProps) {
  const isRunning = useCircuitStore((s) => s.runState === "running");
  const d = data as GateNodeData;
  const def = getGate(d.type);
  const label = `${def.name} on q${d.qubit}${d.control !== undefined ? ` and q${d.control}` : ""}, column ${d.column + 1}${
    d.params?.theta !== undefined ? `, θ = ${formatAngle(d.params.theta)}` : ""
  }`;

  const body = (() => {
    if (d.control === undefined || def.arity === 1) {
      return <GateGlyph type={d.type} params={d.params} size={GRID.GATE} selected={selected} />;
    }

    const dy = (d.control - d.qubit) * GRID.ROW_H;
    const top = Math.min(0, dy);
    const span = Math.abs(dy) + GRID.GATE;

    if (def.render === "box") {
      return (
        <div className="absolute" style={{ top, left: 0 }}>
          <GateGlyph
            type={d.type}
            params={d.params}
            size={GRID.GATE}
            height={span}
            selected={selected}
          />
        </div>
      );
    }

    const color = def.color;
    return (
      <>
        {selected && (
          <div
            className="absolute rounded-lg ring-2 ring-cyber-cyan ring-offset-2 ring-offset-background"
            style={{ left: 2, top: top + 2, width: GRID.GATE - 4, height: span - 4 }}
          />
        )}
        {/* Connector */}
        <div
          className="absolute"
          style={{
            left: C - 1,
            top: C + Math.min(0, dy),
            width: 2,
            height: Math.abs(dy),
            background: color,
          }}
        />
        {def.render === "control-target" && (
          <>
            <ControlDot dy={dy} color={color} />
            <div
              className="absolute flex items-center justify-center rounded-full"
              style={{
                left: C - 15,
                top: C - 15,
                width: 30,
                height: 30,
                border: `2px solid ${color}`,
                background: "hsl(var(--surface))",
              }}
            >
              <svg width={16} height={16} viewBox="0 0 16 16" stroke={color} strokeWidth={2} aria-hidden>
                <path d="M8 1v14M1 8h14" />
              </svg>
            </div>
          </>
        )}
        {def.render === "control-control" && (
          <>
            <ControlDot dy={dy} color={color} />
            <ControlDot dy={0} color={color} />
          </>
        )}
        {def.render === "swap" && (
          <>
            <SwapCross dy={dy} color={color} />
            <SwapCross dy={0} color={color} />
          </>
        )}
      </>
    );
  })();

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
      {body}
    </div>
  );
}

export default memo(GateNode);
