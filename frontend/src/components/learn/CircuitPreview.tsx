"use client";

import { GATES, isGateType } from "@/lib/gates";

export interface CircuitGate {
  type: string;
  targets?: number[];
  control?: number;
  params?: { theta?: number; phi?: number; lambda?: number };
}

export interface CircuitSpec {
  qubits: number;
  gates: CircuitGate[];
}

interface Props {
  spec: CircuitSpec;
  /**
   * Pack gates into shared columns (a gate shares a column with earlier gates
   * when its qubit span does not overlap). Default false keeps the original
   * one-gate-per-column layout used by lessons and chat.
   */
  pack?: boolean;
  /** Draw a dashed accent frame around the diagram (whiteboard highlight). */
  highlighted?: boolean;
  ariaLabel?: string;
}

function gateColor(type: string | undefined): string {
  const key = String(type ?? "").toUpperCase();
  const canonical = key === "CNOT" ? "CX" : key;
  return isGateType(canonical) ? GATES[canonical].color : "var(--quantum)";
}

/** Column index per gate. Sequential unless `pack` is set. */
export function assignColumns(gates: CircuitGate[], qubits: number, pack: boolean): number[] {
  if (!pack) return gates.map((_, i) => i);
  const next = Array.from({ length: Math.max(1, qubits) }, () => 0);
  return gates.map((g) => {
    const qs = [...(g.targets ?? [0]), ...(g.control !== undefined ? [g.control] : [])].filter(
      (q) => q >= 0 && q < next.length
    );
    if (qs.length === 0) return 0;
    const lo = Math.min(...qs);
    const hi = Math.max(...qs);
    let col = 0;
    for (let q = lo; q <= hi; q++) col = Math.max(col, next[q]);
    for (let q = lo; q <= hi; q++) next[q] = col + 1;
    return col;
  });
}

// Layout constants
const WIRE_START_X = 40;
const WIRE_HEIGHT = 50; // vertical spacing between wires
const TOP_PAD = 30;
const GATE_W = 36;
const GATE_H = 30;
const GATE_COL_W = 50; // horizontal spacing between gate columns

export default function CircuitPreview({ spec, pack = false, highlighted = false, ariaLabel = "Circuit diagram" }: Props) {
  const { qubits, gates } = spec;
  const safeQubits = Math.max(1, qubits);

  // Assign each gate to a column (simple sequential layout)
  const colOf = assignColumns(gates, safeQubits, pack);
  const columns = gates.length === 0 ? 0 : Math.max(...colOf) + 1;
  const svgWidth = WIRE_START_X + (columns + 1) * GATE_COL_W + 20;
  const svgHeight = TOP_PAD + safeQubits * WIRE_HEIGHT + 20;

  // Wire y-positions
  const wireY = (q: number) => TOP_PAD + q * WIRE_HEIGHT + WIRE_HEIGHT / 2;
  // Gate x center for column index
  const gateX = (col: number) => WIRE_START_X + (col + 1) * GATE_COL_W;

  return (
    <svg
      data-testid="circuit-preview"
      width={svgWidth}
      height={svgHeight}
      style={{ display: "block", background: "var(--bg-surface)" }}
      role="img"
      aria-label={ariaLabel}
      data-highlighted={highlighted ? "true" : undefined}
    >
      {highlighted && (
        <rect
          data-testid="circuit-highlight"
          x={1}
          y={1}
          width={svgWidth - 2}
          height={svgHeight - 2}
          rx={6}
          fill="none"
          stroke="var(--quantum)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      )}
      {/* Qubit wires */}
      {Array.from({ length: safeQubits }, (_, q) => (
        <line
          key={`wire-${q}`}
          data-testid={`wire-${q}`}
          x1={WIRE_START_X}
          y1={wireY(q)}
          x2={svgWidth - 10}
          y2={wireY(q)}
          stroke="var(--wire)"
          strokeWidth={1.5}
        />
      ))}

      {/* Qubit labels */}
      {Array.from({ length: safeQubits }, (_, q) => (
        <text
          key={`label-${q}`}
          x={WIRE_START_X - 6}
          y={wireY(q) + 4}
          textAnchor="end"
          fontSize={11}
          fill="var(--text-secondary)"
        >
          q{q}
        </text>
      ))}

      {/* Gates */}
      {gates.map((gate, colIdx) => {
        const cx = gateX(colOf[colIdx]);
        const color = gateColor(gate.type);
        const targets = gate.targets ?? [0];

        return (
          <g key={`gate-${colIdx}`}>
            {/* For multi-qubit gates with control, draw a vertical connector line */}
            {gate.control !== undefined && targets.length > 0 && (
              <line
                x1={cx}
                y1={wireY(gate.control)}
                x2={cx}
                y2={wireY(targets[0])}
                stroke={color}
                strokeWidth={1.5}
              />
            )}

            {gate.control === undefined && targets.length > 1 && (
              <line
                x1={cx}
                y1={wireY(Math.min(...targets))}
                x2={cx}
                y2={wireY(Math.max(...targets))}
                stroke={color}
                strokeWidth={1.5}
              />
            )}

            {/* Gate boxes for each target */}
            {targets.map((tgt) => (
              <g key={`gate-${colIdx}-tgt-${tgt}`}>
                <rect
                  x={cx - GATE_W / 2}
                  y={wireY(tgt) - GATE_H / 2}
                  width={GATE_W}
                  height={GATE_H}
                  rx={4}
                  fill="var(--bg-elevated)"
                  stroke={color}
                  strokeWidth={1.5}
                />
                <text
                  x={cx}
                  y={wireY(tgt) + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="600"
                  fill={color}
                >
                  {gate.type}
                </text>
              </g>
            ))}

            {/* Control dot */}
            {gate.control !== undefined && (
              <circle
                cx={cx}
                cy={wireY(gate.control)}
                r={5}
                fill={color}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
