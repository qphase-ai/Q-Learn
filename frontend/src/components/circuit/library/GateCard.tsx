"use client";

import { useRef, useState } from "react";
import { useCircuitStore } from "@/stores/circuitStore";
import { getGate } from "@/lib/gates";
import { cn } from "@/lib/utils";
import GateGlyph from "@/components/circuit/GateGlyph";
import Hint from "@/components/circuit/Hint";
import type { GateType } from "@/types";

export const GATE_DRAG_MIME = "application/gate-type";

/**
 * A draggable gate tile in the library. Drag it onto a qubit wire, or
 * click / press Enter to "arm" it and then click a cell on the canvas.
 */
export default function GateCard({ type }: { type: GateType }) {
  const def = getGate(type);
  const armed = useCircuitStore((s) => s.selectedGateType === type);
  const setSelectedGateType = useCircuitStore((s) => s.setSelectedGateType);
  const setDraggingGateType = useCircuitStore((s) => s.setDraggingGateType);
  const [dragging, setDragging] = useState(false);
  const glyphRef = useRef<HTMLDivElement>(null);

  function handleDragStart(e: React.DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData(GATE_DRAG_MIME, type);
    e.dataTransfer.effectAllowed = "copyMove";
    if (glyphRef.current && typeof e.dataTransfer.setDragImage === "function") {
      e.dataTransfer.setDragImage(glyphRef.current, 20, 20);
    }
    setDragging(true);
    setDraggingGateType(type);
  }

  function handleDragEnd() {
    setDragging(false);
    setDraggingGateType(null);
  }

  return (
    <Hint
      side="right"
      className="max-w-[220px] text-left leading-snug"
      label={
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">
            {def.name}
            {def.params.length > 0 && (
              <span className="ml-1 font-mono font-normal text-muted-foreground">
                ({def.params.map((p) => p.label).join(", ")})
              </span>
            )}
          </span>
          <span className="text-muted-foreground">{def.description}</span>
        </span>
      }
    >
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => setSelectedGateType(armed ? null : type)}
        aria-pressed={armed}
        aria-label={`${def.name} gate${def.arity === 2 ? " (two-qubit)" : ""}. Drag onto a qubit, or press Enter to arm for placement.`}
        data-gate={type}
        className={cn(
          "group flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-transparent px-1 pb-1.5 pt-2 outline-none transition-colors duration-150 active:cursor-grabbing",
          "hover:border-overlay/10 hover:bg-overlay/[0.04]",
          "focus-visible:ring-2 focus-visible:ring-cyber-cyan/70",
          armed && "border-cyber-cyan/50 bg-cyber-cyan/[0.07]",
          dragging && "opacity-40"
        )}
      >
        <div
          ref={glyphRef}
          className="transition-transform duration-150 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
        >
          <GateGlyph type={type} size={40} selected={armed} />
        </div>
        <span
          className={cn(
            "max-w-full truncate text-[10.5px] leading-none",
            armed ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          {def.name}
        </span>
      </button>
    </Hint>
  );
}
