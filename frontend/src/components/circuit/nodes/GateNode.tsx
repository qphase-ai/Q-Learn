"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useCircuitStore } from "@/stores/circuitStore";
import type { GateNodeData, GateType } from "@/types";

function gateColor(type: GateType): string {
  switch (type) {
    case "H":   return "var(--gate-H)";
    case "X":   return "var(--gate-X)";
    case "Y":   return "var(--gate-Y)";
    case "Z":   return "var(--gate-Z)";
    case "CX":
    case "CZ":
    case "SWAP": return "var(--gate-CX)";
    case "S":   return "var(--gate-S)";
    case "T":   return "var(--gate-T)";
    case "I":   return "var(--gate-I)";
    case "M":   return "var(--gate-M)";
    default:    return "var(--bg-elevated)";
  }
}

function GateNode({ data, selected }: NodeProps) {
  const runState = useCircuitStore((s) => s.runState);
  const gateData = data as GateNodeData;
  const { type, control } = gateData;
  const hasTwoQubit = control !== undefined;
  const isRunning = runState === "running";

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* If two-qubit gate, show control dot above */}
      {hasTwoQubit && (
        <>
          {/* Vertical connector line going up */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: "100%",
              transform: "translateX(-50%)",
              width: 2,
              height: 20,
              background: "var(--gate-CX)",
            }}
          />
          {/* Control dot */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: "calc(100% + 20px)",
              transform: "translateX(-50%)",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--gate-CX)",
            }}
          />
        </>
      )}

      {/* Gate body */}
      <div
        style={{
          width: 40,
          height: 40,
          background: gateColor(type),
          border: selected
            ? "2px solid var(--quantum)"
            : "1px solid var(--border)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-primary)",
          cursor: "pointer",
          opacity: isRunning ? 0.7 : 1,
          animation: isRunning ? "pulse 1s ease-in-out infinite" : undefined,
        }}
      >
        {type}
      </div>
    </div>
  );
}

export default memo(GateNode);
