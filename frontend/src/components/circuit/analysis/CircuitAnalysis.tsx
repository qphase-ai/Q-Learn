"use client";

import Link from "next/link";
import { AlertTriangle, Check, Lightbulb } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import { keyInsight } from "@/components/dashboard/CircuitResultsPanel";
import { cn } from "@/lib/utils";
import StateVectorPanel from "@/components/circuit/analysis/StateVectorPanel";
import BlochSpherePanel from "@/components/circuit/analysis/BlochSpherePanel";
import MeasurementResultsPanel from "@/components/circuit/analysis/MeasurementResultsPanel";

type StepState = "done" | "current" | "todo";

/**
 * Build → Simulate → Observe → Explain → Practice. A compact stepper that
 * keeps the learning loop visible next to the results.
 */
function WorkflowSteps({ onExplain }: { onExplain?: () => void }) {
  const hasGates = useCircuitStore((s) => s.nodes.length > 0);
  const runState = useCircuitStore((s) => s.runState);
  const observed = runState === "success";

  const steps: { label: string; state: StepState; action?: React.ReactNode }[] = [
    { label: "Build", state: hasGates ? "done" : "current" },
    {
      label: "Simulate",
      state: observed ? "done" : hasGates ? "current" : "todo",
    },
    { label: "Observe", state: observed ? "done" : "todo" },
    {
      label: "Explain",
      state: observed ? "current" : "todo",
      action: onExplain ? (
        <button
          type="button"
          onClick={onExplain}
          className="rounded outline-none hover:text-electric-purple focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
        >
          Explain
        </button>
      ) : undefined,
    },
    {
      label: "Practice",
      state: "todo",
      action: (
        <Link
          href="/quiz"
          className="rounded outline-none hover:text-cyber-cyan focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
        >
          Practice
        </Link>
      ),
    },
  ];

  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px]" aria-label="Learning workflow">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground/50" aria-hidden>→</span>}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
              s.state === "done" && "text-success",
              s.state === "current" && "bg-cyber-cyan/10 text-cyber-cyan",
              s.state === "todo" && "text-muted-foreground"
            )}
            aria-current={s.state === "current" ? "step" : undefined}
          >
            {s.state === "done" && <Check size={11} aria-hidden />}
            {s.action ?? s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

const GRID_COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } as const;

export default function CircuitAnalysis({
  onExplain,
  columns = 3,
}: {
  onExplain?: () => void;
  /** Panel columns — chosen by the workspace from its own width. */
  columns?: 1 | 2 | 3;
}) {
  const runState = useCircuitStore((s) => s.runState);
  const error = useCircuitStore((s) => s.error);
  const results = useCircuitStore((s) => s.results);
  const insight = runState === "success" ? keyInsight(results?.probabilities) : null;
  const failure = runState === "error" ? error ?? results?.error_message ?? "The simulation failed to run." : null;

  return (
    <section aria-label="Quantum analysis" className="flex flex-col gap-3 border-t border-overlay/10 bg-background p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quantum Analysis
        </h2>
        <WorkflowSteps onExplain={onExplain} />
        {runState === "success" && results?.execution_time_ms != null && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {results.execution_time_ms} ms
          </span>
        )}
      </div>

      {failure && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          <AlertTriangle size={14} className="mt-px flex-shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{failure}</span>
        </p>
      )}

      {insight && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.07] px-3 py-2 text-xs text-foreground">
          <Lightbulb size={14} className="mt-px flex-shrink-0 text-warning" aria-hidden />
          {insight}
        </p>
      )}

      <div className={cn("grid gap-3", GRID_COLS[columns])}>
        <StateVectorPanel className={columns === 2 ? "col-span-2" : undefined} />
        <BlochSpherePanel />
        <MeasurementResultsPanel />
      </div>
    </section>
  );
}
