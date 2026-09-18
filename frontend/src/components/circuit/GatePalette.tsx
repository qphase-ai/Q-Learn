"use client";

import DraggableGate from "@/components/circuit/DraggableGate";
import GatePaletteGroup from "@/components/circuit/GatePaletteGroup";
import type { GateType } from "@/types";

const SINGLE_QUBIT: GateType[] = ["H", "X", "Y", "Z", "S", "T", "I"];
const TWO_QUBIT: GateType[] = ["CX", "CZ", "SWAP"];
const MEASURE: GateType[] = ["M"];

export default function GatePalette() {
  return (
    <aside
      className="flex w-[180px] min-w-[180px] flex-col gap-1 overflow-y-auto border-r border-border bg-surface px-2.5 py-3"
      aria-label="Gate palette"
    >
      <GatePaletteGroup title="Single">
        {SINGLE_QUBIT.map((g) => (
          <DraggableGate key={g} type={g} />
        ))}
      </GatePaletteGroup>

      <GatePaletteGroup title="Two-Qubit">
        {TWO_QUBIT.map((g) => (
          <DraggableGate key={g} type={g} />
        ))}
      </GatePaletteGroup>

      <GatePaletteGroup title="Measure">
        {MEASURE.map((g) => (
          <DraggableGate key={g} type={g} />
        ))}
      </GatePaletteGroup>
    </aside>
  );
}
