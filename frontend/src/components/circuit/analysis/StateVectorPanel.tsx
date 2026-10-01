"use client";

import { useState } from "react";
import { Sigma } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import {
  basisLabel,
  formatComplex,
  formatPolar,
  ketExpression,
  probability,
  qubitCountFromStatevector,
  type Amplitude,
} from "@/lib/quantum-state";
import { cn } from "@/lib/utils";
import AnalysisPanel, { PanelEmpty, PanelSelect } from "@/components/circuit/analysis/AnalysisPanel";

type Notation = "dirac" | "polar" | "probability";

const NOTATIONS: { value: Notation; label: string }[] = [
  { value: "dirac", label: "Dirac" },
  { value: "polar", label: "Polar" },
  { value: "probability", label: "Probabilities" },
];

export default function StateVectorPanel({ className }: { className?: string }) {
  const results = useCircuitStore((s) => s.results);
  const runState = useCircuitStore((s) => s.runState);
  const [notation, setNotation] = useState<Notation>("dirac");

  const sv = (results?.statevector ?? null) as Amplitude[] | null;
  const n = sv ? qubitCountFromStatevector(sv) : 0;

  return (
    <AnalysisPanel
      icon={<Sigma size={14} />}
      title="State Vector"
      className={className}
      actions={
        <PanelSelect label="State vector notation" value={notation} options={NOTATIONS} onChange={setNotation} />
      }
    >
      {runState === "running" && !sv ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Simulating">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-overlay/[0.05] motion-reduce:animate-none" />
          ))}
        </div>
      ) : !sv || sv.length === 0 ? (
        <PanelEmpty>Run a simulation to see the amplitude of every basis state.</PanelEmpty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {notation === "dirac" && (
            <p
              className="truncate rounded-md bg-overlay/[0.03] px-2 py-1.5 font-mono text-[11px] text-foreground"
              title={ketExpression(sv, 16)}
            >
              <span className="text-muted-foreground">|ψ⟩ = </span>
              {ketExpression(sv)}
            </p>
          )}
          <ol className="flex max-h-[176px] flex-col gap-px overflow-y-auto rounded-md border border-overlay/10 bg-overlay/[0.02] p-1 font-mono text-[11.5px]">
            {sv.map((amp, i) => {
              const p = probability(amp);
              const negligible = p < 1e-6;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-3 whitespace-nowrap rounded px-2 py-1",
                    negligible ? "text-muted-foreground/60" : "text-foreground"
                  )}
                >
                  <span className={cn("flex-shrink-0", !negligible && "text-cyber-cyan")}>
                    |{basisLabel(i, n)}⟩
                  </span>
                  {notation === "probability" ? (
                    <>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-overlay/[0.06]">
                        <span
                          className="block h-full rounded-full bg-electric-purple"
                          style={{ width: `${(p * 100).toFixed(2)}%` }}
                        />
                      </span>
                      <span className="w-14 text-right tabular-nums">{(p * 100).toFixed(1)}%</span>
                    </>
                  ) : (
                    <span className="ml-auto tabular-nums">
                      {notation === "polar" ? formatPolar(amp) : formatComplex(amp)}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="text-[10px] text-muted-foreground">
            Qiskit ordering: q<sub>{Math.max(n - 1, 0)}</sub> … q<sub>0</sub>, measurements removed.
          </p>
        </div>
      )}
    </AnalysisPanel>
  );
}
