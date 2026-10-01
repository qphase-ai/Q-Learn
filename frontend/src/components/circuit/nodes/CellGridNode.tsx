"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GRID, xyFromCell } from "@/lib/circuit-spec";
import { getGate } from "@/lib/gates";
import { cn } from "@/lib/utils";
import GateGlyph from "@/components/circuit/GateGlyph";
import type { GateType } from "@/types";

export interface DropPreview {
  type: GateType;
  /** Rows the gate will occupy (target last for two-qubit gates). */
  rows: number[];
  column: number;
  valid: boolean;
}

export interface CellGridData extends Record<string, unknown> {
  cols: number;
  qubitCount: number;
  occupied: Set<string>;
  armed: GateType | null;
  preview: DropPreview | null;
  onPlace: (qubit: number, column: number) => void;
}

const PAD = (GRID.ROW_H - GRID.GATE) / 2;

/**
 * Grid overlay rendered at flow origin (0,0): column indices, the drop-target
 * preview while dragging, and — when a gate is armed — one focusable button
 * per empty cell so circuits can be built with a mouse click or keyboard.
 */
function CellGridNode({ data }: NodeProps) {
  const { cols, qubitCount, occupied, armed, preview, onPlace } =
    data as unknown as CellGridData;
  const columns = Array.from({ length: cols }, (_, c) => c);
  const rows = Array.from({ length: qubitCount }, (_, q) => q);

  return (
    <div className="relative" style={{ pointerEvents: "none" }}>
      {/* Column indices */}
      {columns.map((c) => {
        const { x } = xyFromCell(0, c);
        const active = preview?.column === c;
        return (
          <span
            key={c}
            aria-hidden
            className={cn(
              "absolute select-none text-center font-mono text-[10px] transition-colors",
              active ? "text-cyber-cyan" : "text-muted-foreground/50"
            )}
            style={{ left: x, top: GRID.ORIGIN_Y - 30, width: GRID.GATE }}
          >
            {c + 1}
          </span>
        );
      })}

      {/* Drop / placement preview */}
      {preview && (() => {
        const lo = Math.min(...preview.rows);
        const hi = Math.max(...preview.rows);
        const { x, y } = xyFromCell(lo, preview.column);
        const def = getGate(preview.type);
        const target = preview.rows[preview.rows.length - 1];
        return (
          <>
            {/* Column guide */}
            <div
              aria-hidden
              className={cn(
                "absolute rounded-md",
                preview.valid ? "bg-cyber-cyan/[0.04]" : "bg-error/[0.05]"
              )}
              style={{
                left: x - 6,
                top: GRID.ORIGIN_Y - PAD,
                width: GRID.GATE + 12,
                height: qubitCount * GRID.ROW_H,
              }}
            />
            <div
              aria-hidden
              className={cn(
                "absolute rounded-lg border-2 border-dashed transition-all duration-100",
                preview.valid
                  ? "border-cyber-cyan/70 bg-cyber-cyan/[0.08]"
                  : "border-error/70 bg-error/10"
              )}
              style={{
                left: x - 4,
                top: y - 4,
                width: GRID.GATE + 8,
                height: (hi - lo) * GRID.ROW_H + GRID.GATE + 8,
              }}
            />
            {preview.valid && (
              <div
                aria-hidden
                className="absolute opacity-50"
                style={{ left: x, top: xyFromCell(target, 0).y }}
              >
                <GateGlyph type={preview.type} size={GRID.GATE} showParam={def.params.length > 0} />
              </div>
            )}
          </>
        );
      })()}

      {/* Click-to-place cells (only while a gate is armed) */}
      {armed &&
        rows.map((q) =>
          columns.map((c) => {
            if (occupied.has(`${q}:${c}`)) return null;
            const { x, y } = xyFromCell(q, c);
            return (
              <button
                key={`${q}:${c}`}
                type="button"
                onClick={() => onPlace(q, c)}
                aria-label={`Place ${getGate(armed).name} on q${q}, column ${c + 1}`}
                className="nodrag nopan absolute rounded-lg border border-dashed border-cyber-cyan/0 outline-none transition-colors hover:border-cyber-cyan/60 hover:bg-cyber-cyan/[0.08] focus-visible:border-cyber-cyan focus-visible:bg-cyber-cyan/10"
                style={{ left: x, top: y, width: GRID.GATE, height: GRID.GATE, pointerEvents: "auto" }}
              />
            );
          })
        )}
    </div>
  );
}

export default memo(CellGridNode);
