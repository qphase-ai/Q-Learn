"use client";

import { useState } from "react";
import { MousePointerClick, X } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import { usedColumns } from "@/lib/circuit-spec";
import { getGate } from "@/lib/gates";
import { cn } from "@/lib/utils";
import { useElementWidth } from "@/hooks/useElementWidth";
import GateLibrary from "@/components/circuit/library/GateLibrary";
import CircuitToolbar from "@/components/circuit/CircuitToolbar";
import CircuitCanvas from "@/components/circuit/CircuitCanvas";
import GateInspector from "@/components/circuit/GateInspector";
import CircuitAnalysis from "@/components/circuit/analysis/CircuitAnalysis";

function ArmedChip() {
  const armed = useCircuitStore((s) => s.selectedGateType);
  const setSelectedGateType = useCircuitStore((s) => s.setSelectedGateType);
  if (!armed) return null;
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-cyber-cyan/40 bg-elevated/95 py-1 pl-3 pr-1 text-xs text-foreground shadow-glow-cyan backdrop-blur-md"
    >
      <MousePointerClick size={13} className="text-cyber-cyan" aria-hidden />
      <span>
        Placing <strong className="font-semibold">{getGate(armed).name}</strong> — click a cell
        <span className="text-muted-foreground"> · Esc to cancel</span>
      </span>
      <button
        type="button"
        onClick={() => setSelectedGateType(null)}
        aria-label="Cancel placement"
        className="rounded-full p-1 text-muted-foreground outline-none hover:bg-overlay/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function StatusBar() {
  const nodes = useCircuitStore((s) => s.nodes);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const depth = usedColumns(nodes);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-overlay/10 bg-surface px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
      <span>{qubitCount} qubits</span>
      <span>{nodes.length} {nodes.length === 1 ? "operation" : "operations"}</span>
      <span>depth {depth}</span>
      <span className="ml-auto hidden md:inline">
        Del delete · Ctrl+D duplicate · Ctrl+Z undo · ←↑→↓ move · Space run
      </span>
    </div>
  );
}

// Layout thresholds on the workspace's own width (not the viewport): LabShell's
// curriculum and tutor panels can leave the circuit lab anywhere from ~400px
// to the full screen.
const STATIC_LIBRARY_MIN = 640; // below: library becomes a slide-over drawer
const SIDE_LIBRARY_MIN = 1180; // above: library spans the analysis row too

function analysisColumns(width: number): 1 | 2 | 3 {
  if (width === 0 || width >= 720) return 3;
  return width >= 480 ? 2 : 1;
}

/**
 * The Quantum Circuit Laboratory: gate library | toolbar / canvas (+ inspector)
 * / status bar / analysis. All state lives in `useCircuitStore`.
 */
export default function CircuitWorkspace({
  onExplainCircuit,
  className,
}: {
  onExplainCircuit?: () => void;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [libraryOpen, setLibraryOpen] = useState(false);

  const drawer = width > 0 && width < STATIC_LIBRARY_MIN;
  const analysisBelow = width === 0 || width < SIDE_LIBRARY_MIN;
  const libraryWidth = width >= SIDE_LIBRARY_MIN ? 232 : 212;
  const mainWidth = drawer ? width : width - libraryWidth;
  const analysis = (
    <CircuitAnalysis
      onExplain={onExplainCircuit}
      columns={analysisColumns(analysisBelow ? width : mainWidth)}
    />
  );

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-xl border border-overlay/10 bg-background",
        className
      )}
      data-testid="circuit-workspace"
    >
      <div className="relative flex">
        {/* The library never sets the row height — it scrolls within it. */}
        <div
          className={cn("flex-shrink-0", drawer ? "absolute inset-y-0 left-0 z-30" : "relative")}
          style={{ width: libraryWidth }}
        >
          <GateLibrary
            className={cn(
              "absolute inset-0 border-r border-overlay/10",
              drawer && "shadow-xl transition-transform duration-200 motion-reduce:transition-none",
              drawer && (libraryOpen ? "translate-x-0" : "invisible -translate-x-full")
            )}
          />
        </div>
        {drawer && libraryOpen && (
          <button
            type="button"
            aria-label="Close gate library"
            onClick={() => setLibraryOpen(false)}
            className="absolute inset-0 z-20 bg-background/50"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <CircuitToolbar
            compact={mainWidth > 0 && mainWidth < 720}
            {...(drawer
              ? { libraryOpen, onToggleLibrary: () => setLibraryOpen((v) => !v) }
              : {})}
          />

          <div className="relative bg-[radial-gradient(ellipse_at_top,hsl(var(--cyber-cyan)/0.035),transparent_60%)]">
            <CircuitCanvas />
            <div className="pointer-events-none absolute inset-y-3 right-3 z-10 flex">
              <GateInspector onExplain={onExplainCircuit} />
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 z-10">
              <ArmedChip />
            </div>
          </div>

          <StatusBar />
          {!analysisBelow && analysis}
        </div>
      </div>
      {analysisBelow && analysis}
    </div>
  );
}
