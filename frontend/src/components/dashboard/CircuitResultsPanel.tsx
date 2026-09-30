"use client";

import { useCircuitStore } from "@/stores/circuitStore";
import ProbabilityChart from "@/components/visualization/ProbabilityChart";
import StateVectorTable from "@/components/visualization/StateVectorTable";
import StateSphereVisualization from "@/components/dashboard/StateSphereVisualization";

export function keyInsight(probabilities: Record<string, number> | null | undefined): string | null {
  if (!probabilities) return null;
  const entries = Object.entries(probabilities)
    .filter(([, p]) => p > 0.01)
    .sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    return `The circuit deterministically produces |${entries[0][0]}⟩.`;
  }
  const [first, second] = entries;
  return `The most likely outcomes are |${first[0]}⟩ (${Math.round(first[1] * 100)}%) and |${second[0]}⟩ (${Math.round(second[1] * 100)}%).`;
}

export default function CircuitResultsPanel() {
  const runState = useCircuitStore((s) => s.runState);
  const error = useCircuitStore((s) => s.error);
  const results = useCircuitStore((s) => s.results);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-overlay/10 bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Simulation Results</span>
        {results && (
          <span className={`text-xs ${runState === "error" ? "text-error" : "text-success"}`}>
            {runState === "error" ? "● Simulation failed" : "● Simulation completed"}
          </span>
        )}
      </div>

      {runState === "error" && (
        <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error">
          {error ?? "The simulation failed to run."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Measurement Probabilities
            </p>
            <ProbabilityChart />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">State Vector</p>
            <StateVectorTable />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            Quantum State Visualization
          </p>
          <StateSphereVisualization />
          {keyInsight(results?.probabilities) && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
              <span className="font-medium text-warning">Key Insight: </span>
              {keyInsight(results?.probabilities)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
