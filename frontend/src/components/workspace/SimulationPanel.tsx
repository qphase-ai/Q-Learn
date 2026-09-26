"use client";

import { Play, Loader2, AlertTriangle, Lightbulb } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import ProbabilityChart from "@/components/visualization/ProbabilityChart";
import StateVectorTable from "@/components/visualization/StateVectorTable";

export default function SimulationPanel() {
  const runState = useCircuitStore((s) => s.runState);
  const results = useCircuitStore((s) => s.results);
  const error = useCircuitStore((s) => s.error);
  const nodes = useCircuitStore((s) => s.nodes);
  const runSimulation = useCircuitStore((s) => s.runSimulation);

  const isRunning = runState === "running";
  const hasResults = !!results && (!!results.probabilities || !!results.statevector);
  const hasGates = nodes.length > 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">Simulation Results</span>
          {hasResults && runState === "success" && (
            <span className="flex items-center gap-1 text-[11px] text-success">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              Simulation completed
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => runSimulation()}
          disabled={isRunning || !hasGates}
          className="flex items-center gap-1.5 rounded-lg bg-cyber-cyan px-3 py-1.5 text-xs font-semibold text-background shadow-glow-cyan transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Play size={14} aria-hidden />}
          {isRunning ? "Running…" : "Run Simulation"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4">
        {runState === "error" ? (
          <div className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/10 p-4 text-sm text-error">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden />
            <div>
              <div className="font-medium">Simulation failed</div>
              <div className="mt-0.5 text-xs opacity-90">
                {error ?? results?.error_message ?? "An unknown error occurred."}
              </div>
            </div>
          </div>
        ) : isRunning ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 size={28} className="animate-spin text-cyber-cyan" aria-hidden />
            <p className="text-sm">Simulating on the quantum backend…</p>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <Play size={26} className="text-muted-foreground/50" aria-hidden />
            <p className="text-sm">
              {hasGates ? "Run the simulation to see measurement results." : "Build a circuit, then run the simulation."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Measurement Probabilities
              </h3>
              <ProbabilityChart />
            </section>
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                State Vector
              </h3>
              <StateVectorTable />
              {typeof results?.execution_time_ms === "number" && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Executed in {results.execution_time_ms} ms
                </p>
              )}
            </section>
            <div className="lg:col-span-2">
              <div className="flex items-start gap-2 rounded-lg border border-electric-purple/30 bg-electric-purple/5 p-3 text-xs text-muted-foreground">
                <Lightbulb size={15} className="mt-0.5 flex-shrink-0 text-electric-purple" aria-hidden />
                <span>
                  Measurement collapses the state. Bars show the probability of each basis
                  outcome over the shots run on the simulator.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
