"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Eraser,
  Loader2,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  Redo2,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import { useCircuitStore, MAX_QUBITS, MIN_QUBITS } from "@/stores/circuitStore";
import {
  circuitSpecToQasm,
  circuitSpecToQiskitSource,
  nodesToCircuitSpec,
} from "@/lib/circuit-spec";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Hint from "@/components/circuit/Hint";

const COMPLETE_MS = 2500;

export const toolbarBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-overlay/10 bg-overlay/[0.03] px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-overlay/[0.07] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyber-cyan/70 disabled:pointer-events-none disabled:opacity-40";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "circuit";
}

function CircuitName() {
  const circuitName = useCircuitStore((s) => s.circuitName);
  const renameCircuit = useCircuitStore((s) => s.renameCircuit);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(circuitName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    renameCircuit(draft.trim() || "Untitled Circuit");
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(circuitName);
            setEditing(false);
          }
        }}
        aria-label="Circuit name"
        maxLength={80}
        className="h-8 w-44 rounded-md border border-cyber-cyan/50 bg-overlay/[0.04] px-2 text-sm font-medium text-foreground outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(circuitName);
        setEditing(true);
      }}
      aria-label={`Circuit name: ${circuitName}. Rename`}
      className="group inline-flex h-8 min-w-0 max-w-[220px] items-center gap-2 rounded-md px-2 text-sm font-semibold text-foreground outline-none hover:bg-overlay/[0.05] focus-visible:ring-2 focus-visible:ring-cyber-cyan/70"
    >
      <span className="truncate">{circuitName}</span>
      <Pencil
        size={13}
        className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        aria-hidden
      />
    </button>
  );
}

function RunButton() {
  const runState = useCircuitStore((s) => s.runState);
  const runSimulation = useCircuitStore((s) => s.runSimulation);
  const [justCompleted, setJustCompleted] = useState(false);
  const prev = useRef(runState);

  useEffect(() => {
    if (prev.current === "running" && runState === "success") {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), COMPLETE_MS);
      prev.current = runState;
      return () => clearTimeout(t);
    }
    prev.current = runState;
    if (runState === "running") setJustCompleted(false);
  }, [runState]);

  const running = runState === "running";
  const label = running ? "Simulating…" : justCompleted ? "Simulation Complete" : "Run Simulation";

  return (
    <Hint label={<span>Run on the Qiskit Aer simulator <kbd className="ml-1 font-mono text-muted-foreground">Space</kbd></span>}>
      <button
        type="button"
        onClick={() => runSimulation()}
        disabled={running}
        aria-label={label}
        aria-live="polite"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold outline-none transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyber-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          running
            ? "cursor-progress bg-cyber-cyan/20 text-cyber-cyan"
            : justCompleted
              ? "bg-success/15 text-success ring-1 ring-success/40"
              : "bg-cyber-cyan text-background shadow-glow-cyan hover:brightness-110"
        )}
      >
        {running ? (
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : justCompleted ? (
          <Check size={14} aria-hidden />
        ) : (
          <Play size={13} className="fill-current" aria-hidden />
        )}
        <span>{label}</span>
      </button>
    </Hint>
  );
}

export default function CircuitToolbar({
  compact = false,
  libraryOpen,
  onToggleLibrary,
}: {
  /** Narrow workspace: icon-only secondary buttons (labels move to tooltips). */
  compact?: boolean;
  /** Narrow layouts only: whether the gate library drawer is open. */
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
}) {
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const nodes = useCircuitStore((s) => s.nodes);
  const circuitName = useCircuitStore((s) => s.circuitName);
  const canUndo = useCircuitStore((s) => s.past.length > 0);
  const canRedo = useCircuitStore((s) => s.future.length > 0);
  const runState = useCircuitStore((s) => s.runState);

  const addQubit = useCircuitStore((s) => s.addQubit);
  const setQubitCount = useCircuitStore((s) => s.setQubitCount);
  const clearCircuit = useCircuitStore((s) => s.clearCircuit);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);

  const spec = () => nodesToCircuitSpec(nodes, qubitCount);
  const base = slug(circuitName);
  const counts = Array.from({ length: MAX_QUBITS - MIN_QUBITS + 1 }, (_, i) => i + MIN_QUBITS);

  return (
    <div
      role="toolbar"
      aria-label="Circuit toolbar"
      className="flex min-h-[48px] flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-overlay/10 bg-surface px-2.5 py-2"
    >
      {onToggleLibrary && (
        <Hint label={libraryOpen ? "Hide gate library" : "Show gate library"}>
          <button
            type="button"
            onClick={onToggleLibrary}
            aria-label={libraryOpen ? "Hide gate library" : "Show gate library"}
            aria-expanded={libraryOpen}
            className={cn(toolbarBtn, "px-2", libraryOpen && "border-cyber-cyan/40 text-cyber-cyan")}
          >
            <PanelLeft size={14} aria-hidden />
          </button>
        </Hint>
      )}

      <CircuitName />

      <div className="mx-0.5 h-5 w-px bg-overlay/10" aria-hidden />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={toolbarBtn} aria-label={`${qubitCount} qubits. Change qubit count`}>
            <span className="font-mono">{qubitCount}</span> {qubitCount === 1 ? "Qubit" : "Qubits"}
            <ChevronDown size={13} className="text-muted-foreground" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Qubit count</DropdownMenuLabel>
          {counts.map((n) => (
            <DropdownMenuItem key={n} onSelect={() => setQubitCount(n)} className="text-xs">
              <span className="w-4 font-mono">{n}</span> {n === 1 ? "qubit" : "qubits"}
              {n === qubitCount && <Check size={13} className="ml-auto text-cyber-cyan" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Hint label={qubitCount >= MAX_QUBITS ? `Maximum ${MAX_QUBITS} qubits` : "Add a qubit wire"}>
        <button
          type="button"
          onClick={addQubit}
          disabled={qubitCount >= MAX_QUBITS}
          className={toolbarBtn}
          aria-label="Add qubit"
        >
          <Plus size={14} aria-hidden />
          {!compact && <span>Add Qubit</span>}
        </button>
      </Hint>

      <Hint label="Remove all gates (undoable)">
        <button
          type="button"
          onClick={clearCircuit}
          disabled={nodes.length === 0 && runState === "idle"}
          className={toolbarBtn}
          aria-label="Clear circuit"
        >
          <Eraser size={14} aria-hidden />
          {!compact && <span>Clear</span>}
        </button>
      </Hint>

      <div className="flex items-center">
        <Hint label={<span>Undo <kbd className="ml-1 font-mono text-muted-foreground">Ctrl+Z</kbd></span>}>
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            className={cn(toolbarBtn, "rounded-r-none px-2")}
          >
            <Undo2 size={14} aria-hidden />
          </button>
        </Hint>
        <Hint label={<span>Redo <kbd className="ml-1 font-mono text-muted-foreground">Ctrl+Shift+Z</kbd></span>}>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            className={cn(toolbarBtn, "-ml-px rounded-l-none px-2")}
          >
            <Redo2 size={14} aria-hidden />
          </button>
        </Hint>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {runState === "error" && (
          <span className="inline-flex items-center gap-1 text-xs text-error" role="status">
            <AlertTriangle size={13} aria-hidden /> {!compact && "Run failed"}
          </span>
        )}
        <RunButton />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={toolbarBtn} aria-label="Export circuit">
              <Download size={14} aria-hidden />
              {!compact && <span>Export</span>}
              <ChevronDown size={13} className="text-muted-foreground" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[190px]">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Export as</DropdownMenuLabel>
            <DropdownMenuItem
              className="text-xs"
              onSelect={() =>
                download(`${base}.json`, JSON.stringify(spec(), null, 2), "application/json")
              }
            >
              Circuit JSON
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">.json</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs"
              onSelect={() => download(`${base}.qasm`, circuitSpecToQasm(spec()), "text/plain")}
            >
              OpenQASM 2.0
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">.qasm</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs"
              onSelect={() =>
                download(`${base}.py`, circuitSpecToQiskitSource(spec()), "text/x-python")
              }
            >
              Qiskit Python
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">.py</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
