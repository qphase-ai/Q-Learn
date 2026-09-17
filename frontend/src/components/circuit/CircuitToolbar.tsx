"use client";

import { useCircuitStore } from "@/stores/circuitStore";
import { nodesToCircuitSpec } from "@/lib/circuit-spec";

export default function CircuitToolbar() {
  const circuitName = useCircuitStore((s) => s.circuitName);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const runState = useCircuitStore((s) => s.runState);
  const nodes = useCircuitStore((s) => s.nodes);

  const renameCircuit = useCircuitStore((s) => s.renameCircuit);
  const addQubit = useCircuitStore((s) => s.addQubit);
  const removeQubit = useCircuitStore((s) => s.removeQubit);
  const runSimulation = useCircuitStore((s) => s.runSimulation);
  const clearCircuit = useCircuitStore((s) => s.clearCircuit);

  const isRunning = runState === "running";

  function handleExport() {
    const spec = nodesToCircuitSpec(nodes, qubitCount);
    const json = JSON.stringify(spec, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${circuitName || "circuit"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btnBase: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    cursor: "pointer",
    outline: "none",
    height: 32,
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: isRunning ? "var(--bg-elevated)" : "var(--quantum)",
    color: isRunning ? "var(--text-secondary)" : "var(--bg-base)",
    fontWeight: 600,
    cursor: isRunning ? "not-allowed" : "pointer",
    opacity: isRunning ? 0.6 : 1,
  };

  const iconBtn: React.CSSProperties = {
    ...btnBase,
    padding: "4px 8px",
    fontWeight: 700,
    minWidth: 32,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        height: 44,
        flexShrink: 0,
      }}
      role="toolbar"
      aria-label="Circuit toolbar"
    >
      {/* Circuit name */}
      <input
        type="text"
        value={circuitName}
        onChange={(e) => renameCircuit(e.target.value)}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 13,
          height: 32,
          outline: "none",
          minWidth: 120,
        }}
        aria-label="Circuit name"
      />

      <div
        style={{
          width: 1,
          height: 24,
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      {/* Qubit controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          style={iconBtn}
          onClick={() => removeQubit(qubitCount - 1)}
          aria-label="−"
          title="Remove qubit"
        >
          −
        </button>
        <span
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            minWidth: 60,
            textAlign: "center",
          }}
        >
          {qubitCount} qubits
        </span>
        <button
          style={iconBtn}
          onClick={addQubit}
          aria-label="+"
          title="Add qubit"
        >
          +
        </button>
      </div>

      <div
        style={{
          width: 1,
          height: 24,
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      {/* Run button */}
      <button
        style={btnPrimary}
        onClick={() => runSimulation()}
        disabled={isRunning}
        aria-label={isRunning ? "Running…" : "Run"}
      >
        {isRunning ? "Running…" : "▶ Run"}
      </button>

      {/* Clear button */}
      <button style={btnBase} onClick={clearCircuit}>
        Clear
      </button>

      {/* Export JSON button */}
      <button style={btnBase} onClick={handleExport}>
        Export JSON
      </button>
    </div>
  );
}
