"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import { nodesToCircuitSpec, circuitSpecToQiskitSource } from "@/lib/circuit-spec";

export default function CircuitCodePanel() {
  const nodes = useCircuitStore((s) => s.nodes);
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const [copied, setCopied] = useState(false);

  const source = circuitSpecToQiskitSource(nodesToCircuitSpec(nodes, qubitCount));
  const lines = source.split("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — nothing more we can do here.
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-surface">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium text-foreground">Circuit Code (Qiskit)</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-3 font-code text-[13px] leading-[1.6] text-foreground">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-5 shrink-0 select-none text-right text-muted-foreground/50">
                {i + 1}
              </span>
              <span className="whitespace-pre">{line}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
