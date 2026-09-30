"use client";

import { useCircuitStore } from "@/stores/circuitStore";
import type { GateType } from "@/types";

interface DraggableGateProps {
  type: GateType;
}

function gateBackground(type: GateType): string {
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

/** Label colour for a gate body: fixed on the palette fills, themed on the fallback. */
function gateLabelColor(type: GateType): string {
  switch (type) {
    case "M":   return "var(--gate-label-on-light)";
    case "H": case "X": case "Y": case "Z": case "CX": case "CZ": case "SWAP":
    case "S": case "T": case "I":
      return "var(--gate-label)";
    default:    return "var(--text-primary)";
  }
}

export default function DraggableGate({ type }: DraggableGateProps) {
  const selectedGateType = useCircuitStore((s) => s.selectedGateType);
  const setSelectedGateType = useCircuitStore((s) => s.setSelectedGateType);

  const isSelected = selectedGateType === type;

  function handleDragStart(e: React.DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData("application/gate-type", type);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleClick() {
    setSelectedGateType(type);
  }

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      style={{
        background: gateBackground(type),
        border: isSelected
          ? "2px solid var(--quantum)"
          : "2px solid var(--border)",
        color: gateLabelColor(type),
        borderRadius: 6,
        width: 44,
        height: 44,
        fontSize: 12,
        fontWeight: 600,
        cursor: "grab",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
        userSelect: "none",
      }}
      title={type}
    >
      {type}
    </button>
  );
}
