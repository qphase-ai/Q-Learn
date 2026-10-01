"use client";

import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Copy, Sparkles, Trash2, X } from "lucide-react";
import { useCircuitStore } from "@/stores/circuitStore";
import { ANGLE_PRESETS, formatAngle, getGate, type GateParamDef } from "@/lib/gates";
import { cn } from "@/lib/utils";
import GateGlyph from "@/components/circuit/GateGlyph";
import type { GateNodeData } from "@/types";

/** Parse "π/4", "-pi/2", "3π/4", "0.5", "2pi" into radians. */
export function parseAngle(input: string): number | null {
  const m = input
    .trim()
    .toLowerCase()
    .replace(/−/g, "-")
    .match(/^(-)?\s*(\d*\.?\d*)\s*(π|pi)?\s*(?:\/\s*(\d*\.?\d+))?$/);
  if (!m) return null;
  const [, neg, num, pi, den] = m;
  if (!num && !pi) return null;
  let v = num ? Number(num) : 1;
  if (Number.isNaN(v)) return null;
  if (pi) v *= Math.PI;
  if (den) {
    const d = Number(den);
    if (!d) return null;
    v /= d;
  }
  return neg ? -v : v;
}

function Matrix({ tex }: { tex: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: true, output: "html" }),
    [tex]
  );
  return (
    <div
      className="overflow-x-auto rounded-md border border-overlay/10 bg-overlay/[0.03] px-2 py-1 text-[12px] text-foreground [&_.katex-display]:my-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function AngleField({
  def,
  value,
  onChange,
}: {
  def: GateParamDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(formatAngle(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(formatAngle(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const v = parseAngle(draft);
    if (v === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (Math.abs(v - value) > 1e-12) onChange(v);
    else setDraft(formatAngle(value));
  }

  const id = `gate-param-${def.key}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="w-4 font-mono text-xs text-muted-foreground">
          {def.label}
        </label>
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          className={cn(
            "h-7 min-w-0 flex-1 rounded-md border bg-overlay/[0.03] px-2 font-mono text-xs text-foreground outline-none focus:border-cyber-cyan/60",
            invalid ? "border-error/70" : "border-overlay/10"
          )}
        />
        <span className="w-14 text-right font-mono text-[10px] text-muted-foreground">
          {value.toFixed(3)}
        </span>
      </div>
      <span id={`${id}-hint`} className="sr-only">
        Angle in radians. Accepts values like pi/4 or 0.5.
      </span>
      <div className="flex gap-1 pl-6">
        {ANGLE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.value)}
            aria-label={`Set ${def.label} to ${p.label}`}
            className={cn(
              "h-6 flex-1 rounded border font-mono text-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyber-cyan/60",
              Math.abs(value - p.value) < 1e-9
                ? "border-cyber-cyan/50 bg-cyber-cyan/10 text-cyber-cyan"
                : "border-overlay/10 text-muted-foreground hover:bg-overlay/[0.05] hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QubitSelect({
  id,
  label,
  value,
  count,
  disabledValue,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  count: number;
  disabledValue?: number;
  onChange: (q: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 rounded-md border border-overlay/10 bg-surface px-1.5 font-mono text-xs text-foreground outline-none focus:border-cyber-cyan/60"
      >
        {Array.from({ length: count }, (_, q) => (
          <option key={q} value={q} disabled={q === disabledValue}>
            q{q}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function GateInspector({ onExplain }: { onExplain?: () => void }) {
  const selected = useCircuitStore((s) => {
    const sel = s.nodes.filter((n) => n.selected);
    return sel.length === 1 ? sel[0] : null;
  });
  const qubitCount = useCircuitStore((s) => s.qubitCount);
  const updateGate = useCircuitStore((s) => s.updateGate);
  const duplicateSelected = useCircuitStore((s) => s.duplicateSelected);
  const removeSelected = useCircuitStore((s) => s.removeSelected);
  const selectGate = useCircuitStore((s) => s.selectGate);
  const [collapsed, setCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();

  const d = selected ? (selected.data as GateNodeData) : null;
  const def = d ? getGate(d.type) : null;
  const twoQubit = d?.control !== undefined;
  const controlled = def?.render === "control-target";

  return (
    <AnimatePresence>
      {selected && d && def && (
        <motion.section
          key="inspector"
          role="region"
          aria-label={`Gate inspector: ${def.name}`}
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="pointer-events-auto flex max-h-full w-[264px] flex-col overflow-hidden rounded-xl border border-overlay/10 bg-elevated"
        >
          <header className="flex items-center gap-2.5 border-b border-overlay/10 px-3 py-2.5">
            <GateGlyph type={d.type} params={d.params} size={32} showParam={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gate</p>
              <h3 className="truncate text-sm font-semibold text-foreground">{def.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand inspector" : "Collapse inspector"}
              className="rounded p-1 text-muted-foreground outline-none hover:bg-overlay/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
            >
              <ChevronDown size={14} className={cn("transition-transform", collapsed && "-rotate-90")} />
            </button>
            <button
              type="button"
              onClick={() => selectGate(null)}
              aria-label="Close inspector"
              className="rounded p-1 text-muted-foreground outline-none hover:bg-overlay/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
            >
              <X size={14} />
            </button>
          </header>

          {!collapsed && (
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {d.type === "M" ? "Operators" : "Matrix"}
                </p>
                <Matrix tex={def.matrix} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {twoQubit ? (
                  <>
                    <QubitSelect
                      id="gate-control"
                      label={controlled ? "Control" : "Qubit A"}
                      value={d.control!}
                      count={qubitCount}
                      disabledValue={d.qubit}
                      onChange={(q) => updateGate(selected.id, { control: q })}
                    />
                    <QubitSelect
                      id="gate-target"
                      label={controlled ? "Target" : "Qubit B"}
                      value={d.qubit}
                      count={qubitCount}
                      disabledValue={d.control}
                      onChange={(q) => updateGate(selected.id, { qubit: q })}
                    />
                  </>
                ) : (
                  <QubitSelect
                    id="gate-qubit"
                    label="Qubit"
                    value={d.qubit}
                    count={qubitCount}
                    onChange={(q) => updateGate(selected.id, { qubit: q })}
                  />
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Position</span>
                  <span className="flex h-7 items-center font-mono text-xs text-foreground">
                    Column {d.column + 1}
                  </span>
                </div>
              </div>

              {def.params.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parameters</p>
                  {def.params.map((p) => (
                    <AngleField
                      key={p.key}
                      def={p}
                      value={d.params?.[p.key] ?? p.default}
                      onChange={(v) => updateGate(selected.id, { params: { [p.key]: v } })}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="text-xs leading-relaxed text-foreground/90">{def.description}</p>
              </div>
            </div>
          )}

          <footer className="flex items-center gap-1 border-t border-overlay/10 px-2 py-1.5">
            <button
              type="button"
              onClick={duplicateSelected}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-overlay/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
              aria-label="Duplicate gate (Ctrl+D)"
              title="Duplicate (Ctrl+D)"
            >
              <Copy size={13} aria-hidden /> Duplicate
            </button>
            <button
              type="button"
              onClick={removeSelected}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-error/10 hover:text-error focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
              aria-label="Delete gate (Delete)"
              title="Delete (Del)"
            >
              <Trash2 size={13} aria-hidden /> Delete
            </button>
            {onExplain && (
              <button
                type="button"
                onClick={onExplain}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-electric-purple outline-none hover:bg-electric-purple/10 focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
                aria-label="Ask the AI tutor to explain this circuit"
                title="Ask the AI tutor"
              >
                <Sparkles size={13} aria-hidden /> Explain
              </button>
            )}
          </footer>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
