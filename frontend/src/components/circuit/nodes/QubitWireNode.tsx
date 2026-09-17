"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

interface QubitWireData extends Record<string, unknown> {
  index: number;
}

function QubitWireNode({ data }: NodeProps) {
  const { index } = data as unknown as QubitWireData;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 44,
        display: "flex",
        alignItems: "center",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Label */}
      <span
        style={{
          position: "absolute",
          left: 0,
          color: "var(--text-secondary)",
          fontSize: 12,
          fontFamily: "monospace",
          fontWeight: 600,
          whiteSpace: "nowrap",
          zIndex: 1,
        }}
      >
        q{index}
      </span>
      {/* Wire line */}
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 0,
          top: "50%",
          height: 1,
          background: "var(--wire)",
          transform: "translateY(-50%)",
        }}
      />
    </div>
  );
}

export default memo(QubitWireNode);
