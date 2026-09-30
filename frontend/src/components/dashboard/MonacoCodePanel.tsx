"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useCircuitStore } from "@/stores/circuitStore";
import { nodesToCircuitSpec, circuitSpecToQiskitSource } from "@/lib/circuit-spec";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Monaco needs `window`/workers — dynamic-import only, never SSR'd, per
// frontend/CLAUDE.md's "Monaco Editor: dynamic import only" rule.
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function MonacoCodePanel() {
  const { resolvedTheme } = useTheme();
  const nodes = useCircuitStore((s) => s.nodes);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const runSimulation = useCircuitStore((s) => s.runSimulation);
  const runState = useCircuitStore((s) => s.runState);

  const generatedSource = circuitSpecToQiskitSource(nodesToCircuitSpec(nodes, qubitCount));
  const [buffer, setBuffer] = useState(generatedSource);
  const prevGeneratedRef = useRef(generatedSource);

  // Follow the live circuit as it's edited on the canvas, as long as the
  // student hasn't diverged the buffer yet.
  useEffect(() => {
    setBuffer((current) => {
      const wasFollowing = current === prevGeneratedRef.current;
      prevGeneratedRef.current = generatedSource;
      return wasFollowing ? generatedSource : current;
    });
  }, [generatedSource]);

  const isEdited = buffer !== generatedSource;
  const isRunning = runState === "running";

  const runButton = (
    <button
      type="button"
      onClick={() => runSimulation()}
      disabled={isEdited || isRunning}
      className="h-8 rounded-md bg-cyber-cyan px-2.5 text-[13px] font-semibold text-background shadow-glow-cyan disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted-foreground disabled:opacity-60 disabled:shadow-none"
    >
      {isRunning ? "Running…" : "▶ Run"}
    </button>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-overlay/10 bg-surface">
      <div className="flex items-center justify-between border-b border-overlay/10 px-3 py-2">
        <span className="text-sm font-medium text-foreground">circuit.py</span>
        {isEdited ? (
          // A local TooltipProvider is required here: this file is rendered in
          // isolation by MonacoCodePanel.test.tsx, without the app-level
          // TooltipProvider from `app/providers.tsx`. In production this nests
          // harmlessly inside the root provider.
          <TooltipProvider>
            <Tooltip>
              {/* Radix Tooltip needs pointer events the disabled `runButton`
                  can't reliably fire — wrap it in a plain span, which can,
                  and trigger off that instead. */}
              <TooltipTrigger asChild>
                <span tabIndex={0}>{runButton}</span>
              </TooltipTrigger>
              <TooltipContent>
                Custom code execution isn&apos;t connected to a backend sandbox yet — edit the
                circuit on the Circuit tab to change what runs.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          runButton
        )}
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          language="python"
          theme={resolvedTheme === "light" ? "light" : "vs-dark"}
          value={buffer}
          onChange={(v) => setBuffer(v ?? "")}
          options={{ fontSize: 13, minimap: { enabled: false }, fontFamily: "var(--font-mono)" }}
        />
      </div>
    </div>
  );
}
