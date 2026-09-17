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
      style={{
        width: 180,
        minWidth: 180,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        padding: "12px 10px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
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
