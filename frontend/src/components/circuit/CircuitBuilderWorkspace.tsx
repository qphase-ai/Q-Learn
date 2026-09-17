"use client";

import GatePalette from "@/components/circuit/GatePalette";
import CircuitToolbar from "@/components/circuit/CircuitToolbar";
import CircuitCanvas from "@/components/circuit/CircuitCanvas";
import { useCircuitShortcuts } from "@/hooks/useCircuitShortcuts";

export default function CircuitBuilderWorkspace() {
  useCircuitShortcuts();

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <GatePalette />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <CircuitToolbar />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <CircuitCanvas />
        </div>
      </div>
    </div>
  );
}
