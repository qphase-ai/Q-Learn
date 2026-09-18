"use client";

import { useCircuitStore } from "@/stores/circuitStore";
import { nodesToCircuitSpec } from "@/lib/circuit-spec";
import { cn } from "@/lib/utils";

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

  const btnBase =
    "h-8 rounded-md border border-border bg-elevated px-2.5 text-[13px] text-foreground outline-none cursor-pointer";

  return (
    <div
      className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-surface px-3"
      style={{ height: 44 }}
      role="toolbar"
      aria-label="Circuit toolbar"
    >
      {/* Circuit name */}
      <input
        type="text"
        value={circuitName}
        onChange={(e) => renameCircuit(e.target.value)}
        className="h-8 min-w-[120px] rounded-md border border-border bg-elevated px-2 text-[13px] text-foreground outline-none"
        aria-label="Circuit name"
      />

      <div className="h-6 w-px flex-shrink-0 bg-border" />

      {/* Qubit controls */}
      <div className="flex items-center gap-1">
        <button
          className={cn(btnBase, "min-w-[32px] px-2 font-bold")}
          onClick={() => removeQubit(qubitCount - 1)}
          aria-label="−"
          title="Remove qubit"
        >
          −
        </button>
        <span className="min-w-[60px] text-center text-[13px] text-muted-foreground">
          {qubitCount} qubits
        </span>
        <button
          className={cn(btnBase, "min-w-[32px] px-2 font-bold")}
          onClick={addQubit}
          aria-label="+"
          title="Add qubit"
        >
          +
        </button>
      </div>

      <div className="h-6 w-px flex-shrink-0 bg-border" />

      {/* Run button */}
      <button
        className={cn(
          "h-8 cursor-pointer rounded-md px-2.5 text-[13px] font-semibold outline-none",
          isRunning
            ? "cursor-not-allowed bg-elevated text-muted-foreground opacity-60"
            : "bg-cyber-cyan text-background shadow-glow-cyan hover:brightness-110"
        )}
        onClick={() => runSimulation()}
        disabled={isRunning}
        aria-label={isRunning ? "Running…" : "Run"}
      >
        {isRunning ? "Running…" : "▶ Run"}
      </button>

      {/* Clear button */}
      <button className={btnBase} onClick={clearCircuit}>
        Clear
      </button>

      {/* Export JSON button */}
      <button className={btnBase} onClick={handleExport}>
        Export JSON
      </button>
    </div>
  );
}
