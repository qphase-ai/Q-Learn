"use client";

import GatePalette from "@/components/circuit/GatePalette";
import CircuitToolbar from "@/components/circuit/CircuitToolbar";
import CircuitCanvas from "@/components/circuit/CircuitCanvas";
import { useCircuitShortcuts } from "@/hooks/useCircuitShortcuts";

export default function CircuitBuilderWorkspace() {
  useCircuitShortcuts();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <GatePalette />

      <div className="flex flex-1 flex-col overflow-hidden">
        <CircuitToolbar />
        <div className="flex-1 overflow-hidden">
          <CircuitCanvas />
        </div>
      </div>
    </div>
  );
}
