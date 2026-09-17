"use client";

import { useCircuitStore } from "@/stores/circuitStore";

export default function QASMViewer() {
  const results = useCircuitStore((s) => s.results);

  if (!results || !results.qasm) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Run a circuit to see results.
      </p>
    );
  }

  const { qasm } = results;

  function handleCopy() {
    navigator.clipboard.writeText(qasm);
  }

  return (
    <div className="flex flex-col gap-2 w-full h-full">
      <div className="flex justify-end">
        <button
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          Copy
        </button>
      </div>
      <pre
        className="flex-1 overflow-auto p-2 rounded text-xs font-code"
        style={{
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
        }}
      >
        {qasm}
      </pre>
    </div>
  );
}
