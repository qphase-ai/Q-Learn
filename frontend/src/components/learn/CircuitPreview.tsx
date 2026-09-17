"use client";

export interface CircuitGate {
  type: string;
  targets?: number[];
  control?: number;
}

export interface CircuitSpec {
  qubits: number;
  gates: CircuitGate[];
}

interface Props {
  spec: CircuitSpec;
}

const GATE_TOKEN_MAP: Record<string, string> = {
  H: "var(--gate-H)",
  X: "var(--gate-X)",
  Y: "var(--gate-Y)",
  Z: "var(--gate-Z)",
  CX: "var(--gate-CX)",
  CNOT: "var(--gate-CX)",
  M: "var(--gate-M)",
};

function gateColor(type: string | undefined): string {
  const key = String(type ?? "").toUpperCase();
  return GATE_TOKEN_MAP[key] ?? "var(--quantum)";
}

// Layout constants
const WIRE_START_X = 40;
const WIRE_HEIGHT = 50; // vertical spacing between wires
const TOP_PAD = 30;
const GATE_W = 36;
const GATE_H = 30;
const GATE_COL_W = 50; // horizontal spacing between gate columns

export default function CircuitPreview({ spec }: Props) {
  const { qubits, gates } = spec;
  const safeQubits = Math.max(1, qubits);

  // Assign each gate to a column (simple sequential layout)
  const columns = gates.length;
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
      aria-label="Circuit diagram"
    >
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
        const cx = gateX(colIdx);
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
