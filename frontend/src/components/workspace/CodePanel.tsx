"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import { nodesToCircuitSpec, specToQiskit } from "@/lib/circuit-spec";

/**
 * Qiskit code for the circuit the student has actually built. This is a
 * deterministic translation of the current `circuitStore` graph (not sample
 * code); it updates live as gates are placed.
 */
export default function CodePanel() {
  const nodes = useCircuitStore((s) => s.nodes);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const circuitName = useCircuitStore((s) => s.circuitName);
  const [copied, setCopied] = useState(false);

  const code = useMemo(
    () => specToQiskit(nodesToCircuitSpec(nodes, qubitCount), circuitName),
    [nodes, qubitCount, circuitName]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const lines = code.split("\n");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-[13px] font-medium text-foreground">Circuit Code (Qiskit)</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-background/40 p-4">
        <pre className="font-code text-[13px] leading-6 text-foreground">
          <code>
            {lines.map((line, i) => (
              <span key={i} className="grid grid-cols-[2.5rem_1fr]">
                <span className="select-none text-right text-muted-foreground/50 pr-4">{i + 1}</span>
                <span className="whitespace-pre-wrap">{line}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
