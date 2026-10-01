"use client";

import { BarChart3 } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import { basisLabel } from "@/lib/quantum-state";
import { cn } from "@/lib/utils";
import AnalysisPanel, { PanelEmpty, PanelSelect } from "@/components/circuit/analysis/AnalysisPanel";

const SHOT_OPTIONS = [256, 512, 1024, 2048, 4096].map((v) => ({ value: v, label: v.toLocaleString() }));
const ALL_STATES_MAX_QUBITS = 4;

export default function MeasurementResultsPanel() {
  const results = useCircuitStore((s) => s.results);
  const runState = useCircuitStore((s) => s.runState);
  const shots = useCircuitStore((s) => s.shots);
  const setShots = useCircuitStore((s) => s.setShots);
  const hasMeasurement = useCircuitStore((s) =>
    s.nodes.some((n) => (n.data as { type?: string }).type === "M")
  );

  const probabilities = results?.probabilities ?? null;
  const counts = results?.measurements ?? {};
  const keys = probabilities ? Object.keys(probabilities) : [];
  const width = keys.reduce((m, k) => Math.max(m, k.replace(/\s/g, "").length), 0);

  // Show every basis state for small registers (zeros are informative); only
  // observed outcomes for larger ones.
  const labels =
    width > 0 && width <= ALL_STATES_MAX_QUBITS
      ? Array.from({ length: 2 ** width }, (_, i) => basisLabel(i, width))
      : [...keys].sort();
  const bars = labels.map((label) => ({
    label,
    p: probabilities?.[label] ?? 0,
    count: counts[label] ?? 0,
  }));
  const maxP = Math.max(0, ...bars.map((b) => b.p));
  const totalShots = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <AnalysisPanel
      icon={<BarChart3 size={14} />}
      title="Measurement Results"
      actions={
        <>
          <span className="text-[11px] text-muted-foreground">Shots</span>
          <PanelSelect label="Shots for the next run" value={shots} options={SHOT_OPTIONS} onChange={setShots} />
        </>
      }
    >
      {runState === "running" && !probabilities ? (
        <div className="flex flex-1 items-end gap-2 px-2 pb-6" aria-busy="true" aria-label="Simulating">
          {[40, 15, 15, 40].map((h, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-t bg-overlay/[0.06] motion-reduce:animate-none" style={{ height: `${h * 2}px` }} />
          ))}
        </div>
      ) : bars.length === 0 ? (
        <PanelEmpty>
          {hasMeasurement
            ? "Run a simulation to sample measurement outcomes."
            : "Add measurement (M) gates, then run the simulation to sample outcomes."}
        </PanelEmpty>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          <figure
            className="flex flex-1 flex-col"
            aria-label={`Measurement distribution over ${totalShots || shots} shots`}
          >
            <div className="relative mt-4 flex min-h-[140px] flex-1 items-end gap-1.5 border-b border-l border-overlay/10 pl-1">
              {/* Gridlines at 25 / 50 / 75 / 100 % probability */}
              {[0.25, 0.5, 0.75, 1].map((g) => (
                <div
                  key={g}
                  aria-hidden
                  className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-overlay/[0.07]"
                  style={{ bottom: `${g * 100}%` }}
                />
              ))}
              {bars.map((b) => {
                const top = b.p > 0 && b.p === maxP;
                const pct = (b.p * 100).toFixed(1);
                return (
                  <div
                    key={b.label}
                    className="group relative flex h-full min-w-0 flex-1 justify-center"
                    title={`|${b.label}⟩: ${pct}% (${b.count} shots)`}
                  >
                    <div
                      className={cn(
                        "absolute bottom-0 w-full max-w-[44px] rounded-t-[4px] transition-[height] duration-500 ease-out motion-reduce:transition-none",
                        top ? "bg-cyber-cyan" : "bg-electric-purple/80 group-hover:bg-electric-purple"
                      )}
                      style={{ height: `${b.p * 100}%`, minHeight: b.p > 0 ? 2 : 0 }}
                    />
                    <span
                      className={cn(
                        "absolute font-mono text-[10px] tabular-nums",
                        b.p > 0 ? "text-foreground" : "text-muted-foreground/60"
                      )}
                      style={{ bottom: `calc(${b.p * 100}% + 3px)` }}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1.5 pl-1 pt-1">
              {bars.map((b) => (
                <span key={b.label} className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-muted-foreground">
                  {b.label}
                </span>
              ))}
            </div>
            <figcaption className="sr-only">
              {bars.map((b) => `${b.label}: ${(b.p * 100).toFixed(1)} percent`).join(", ")}
            </figcaption>
          </figure>
          <p className="text-[10px] text-muted-foreground">
            {totalShots > 0 ? `${totalShots.toLocaleString()} shots sampled` : "Probabilities"} · bit order c
            <sub>{Math.max(width - 1, 0)}</sub>…c<sub>0</sub>
          </p>
        </div>
      )}
    </AnalysisPanel>
  );
}
