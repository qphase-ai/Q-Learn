"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

function MeasurementNode({ selected }: NodeProps) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        background: "var(--gate-M)",
        border: selected
          ? "2px solid var(--quantum)"
          : "1px solid var(--border)",
        borderBottom: "3px dashed var(--border)",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--bg-base)",
        cursor: "pointer",
      }}
    >
      M
    </div>
  );
}

export default memo(MeasurementNode);
