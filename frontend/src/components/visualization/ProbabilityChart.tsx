"use client";

import { useCircuitStore } from "@/stores/circuitStore";

export default function ProbabilityChart() {
  const results = useCircuitStore((s) => s.results);

  if (!results || !results.probabilities) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Run a circuit to see results.
      </p>
    );
  }

  const sorted = Object.entries(results.probabilities).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="flex flex-col gap-2 w-full">
      {sorted.map(([key, prob]) => {
        const pct = Math.round(prob * 100);
        return (
          <div key={key} className="flex items-center gap-2 w-full">
            <span
              className="text-xs font-mono w-10 shrink-0"
              style={{ color: "var(--text-secondary)" }}
            >
              |{key}⟩
            </span>
            <div
              className="flex-1 h-4 rounded overflow-hidden"
              style={{ background: "var(--bg-elevated)" }}
            >
              <div
                className="h-full rounded transition-[width] duration-500 ease-out"
                style={{
                  width: `${prob * 100}%`,
                  background: "var(--quantum)",
                }}
                title={String(prob)}
              />
            </div>
            <span
              className="text-xs w-9 text-right shrink-0"
              style={{ color: "var(--text-primary)" }}
            >
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
