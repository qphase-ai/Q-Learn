"use client";

import { useState } from "react";

interface GatePaletteGroupProps {
  title: string;
  children: React.ReactNode;
}

export default function GatePaletteGroup({ title, children }: GatePaletteGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          color: "var(--text-secondary)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: "pointer",
          padding: "4px 0",
          outline: "none",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            paddingTop: 6,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
