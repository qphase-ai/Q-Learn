"use client";

import { FileCode2 } from "lucide-react";

/**
 * Static file tree for the /code workspace. `circuit.py` is the one live
 * file — its content is the freshly generated Qiskit source for the current
 * circuit (see MonacoCodePanel). The starter files below are illustrative,
 * read-only reference snippets; there is no backend file-listing endpoint
 * yet, so this list is hardcoded rather than fetched.
 */
const STARTER_FILES = ["starter_bell_state.py", "starter_ghz_state.py"];

export default function FileTreePanel({ activeFile }: { activeFile: string }) {
  return (
    <aside
      className="flex w-[200px] flex-shrink-0 flex-col gap-1 overflow-y-auto border-r border-overlay/10 bg-surface p-2"
      aria-label="Code files"
    >
      <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Your Circuit
      </p>
      <button
        type="button"
        aria-current={activeFile === "circuit.py" ? "true" : undefined}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
          activeFile === "circuit.py"
            ? "bg-cyber-cyan/10 text-cyber-cyan"
            : "text-foreground hover:bg-overlay/5"
        }`}
      >
        <FileCode2 size={14} aria-hidden />
        circuit.py
      </button>

      <p className="mt-3 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Starter Examples
      </p>
      {STARTER_FILES.map((file) => (
        <span
          key={file}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground opacity-70"
        >
          <FileCode2 size={14} aria-hidden />
          {file}
        </span>
      ))}
    </aside>
  );
}
