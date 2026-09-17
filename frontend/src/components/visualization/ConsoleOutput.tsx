"use client";

import { useCircuitStore } from "@/stores/circuitStore";

export default function ConsoleOutput() {
  const results = useCircuitStore((s) => s.results);

  if (!results) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Run a circuit to see results.
      </p>
    );
  }

  if (results.error_message) {
    return (
      <p className="text-sm font-mono" style={{ color: "var(--error)" }}>
        {results.error_message}
      </p>
    );
  }

  return (
    <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
      {results.status}
    </p>
  );
}
