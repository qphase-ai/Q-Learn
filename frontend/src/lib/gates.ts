import type { GateParams, GateType } from "@/types";

// ---------------------------------------------------------------------------
// Gate catalog — single source of truth for everything the circuit builder
// shows about a gate (library card, canvas node, inspector, export).
// ---------------------------------------------------------------------------

export type GateCategory = "single" | "multi" | "measure";
export type GateParamKey = keyof GateParams;

export interface GateParamDef {
  key: GateParamKey;
  label: string;
  default: number;
}

export interface GateDef {
  type: GateType;
  /** Short label drawn on the gate body. */
  symbol: string;
  name: string;
  description: string;
  category: GateCategory;
  /** Listed under "More Gates" instead of the main category grid. */
  more?: boolean;
  arity: 1 | 2;
  params: GateParamDef[];
  /** CSS colour for the gate body / accent. */
  color: string;
  /** solid = filled body, outline = dark body with a coloured border. */
  variant: "solid" | "outline";
  /** KaTeX source for the unitary (or measurement operators). */
  matrix: string;
  /** How a two-qubit gate is drawn on the canvas. */
  render?: "control-target" | "control-control" | "swap" | "box";
  /** Extra words matched by library search. */
  keywords?: string;
}

const THETA: GateParamDef = { key: "theta", label: "θ", default: Math.PI / 2 };
const PHI: GateParamDef = { key: "phi", label: "φ", default: 0 };
const LAMBDA: GateParamDef = { key: "lambda", label: "λ", default: 0 };

const bm = (body: string) => `\\begin{bmatrix}${body}\\end{bmatrix}`;
const c2 = "\\cos\\tfrac{\\theta}{2}";
const s2 = "\\sin\\tfrac{\\theta}{2}";

const DEFS: GateDef[] = [
  {
    type: "H", symbol: "H", name: "Hadamard", category: "single", arity: 1, params: [],
    color: "var(--gate-H)", variant: "solid",
    description: "Creates an equal superposition: maps |0⟩ to |+⟩ and |1⟩ to |−⟩.",
    matrix: `\\tfrac{1}{\\sqrt{2}}${bm("1 & 1 \\\\ 1 & -1")}`,
    keywords: "superposition plus minus",
  },
  {
    type: "X", symbol: "X", name: "Pauli-X", category: "single", arity: 1, params: [],
    color: "var(--gate-X)", variant: "solid",
    description: "Quantum NOT — flips |0⟩ ↔ |1⟩ (a π rotation about the X axis).",
    matrix: bm("0 & 1 \\\\ 1 & 0"),
    keywords: "not bit flip",
  },
  {
    type: "Y", symbol: "Y", name: "Pauli-Y", category: "single", arity: 1, params: [],
    color: "var(--gate-Y)", variant: "solid",
    description: "Bit and phase flip — a π rotation about the Y axis.",
    matrix: bm("0 & -i \\\\ i & 0"),
  },
  {
    type: "Z", symbol: "Z", name: "Pauli-Z", category: "single", arity: 1, params: [],
    color: "var(--gate-Z)", variant: "solid",
    description: "Phase flip — leaves |0⟩ unchanged and maps |1⟩ to −|1⟩.",
    matrix: bm("1 & 0 \\\\ 0 & -1"),
    keywords: "phase flip",
  },
  {
    type: "S", symbol: "S", name: "S Gate", category: "single", arity: 1, params: [],
    color: "var(--gate-S)", variant: "solid",
    description: "Quarter-turn phase gate (√Z): adds a phase of i to |1⟩.",
    matrix: bm("1 & 0 \\\\ 0 & i"),
    keywords: "phase sqrt z",
  },
  {
    type: "T", symbol: "T", name: "T Gate", category: "single", arity: 1, params: [],
    color: "var(--gate-T)", variant: "solid",
    description: "Eighth-turn phase gate (√S): adds a phase of e^{iπ/4} to |1⟩.",
    matrix: bm("1 & 0 \\\\ 0 & e^{i\\pi/4}"),
    keywords: "phase pi/8",
  },
  {
    type: "I", symbol: "I", name: "Identity", category: "single", arity: 1, params: [],
    color: "var(--gate-I)", variant: "solid",
    description: "Does nothing — useful as an explicit idle step.",
    matrix: bm("1 & 0 \\\\ 0 & 1"),
    keywords: "idle wait",
  },
  {
    type: "RX", symbol: "Rx", name: "R-X", category: "single", arity: 1, params: [THETA],
    color: "var(--gate-rot)", variant: "outline",
    description: "Rotates the state by θ around the X axis of the Bloch sphere.",
    matrix: bm(`${c2} & -i${s2} \\\\ -i${s2} & ${c2}`),
    keywords: "rotation",
  },
  {
    type: "RY", symbol: "Ry", name: "R-Y", category: "single", arity: 1, params: [THETA],
    color: "var(--gate-rot)", variant: "outline",
    description: "Rotates the state by θ around the Y axis — real-valued amplitudes.",
    matrix: bm(`${c2} & -${s2} \\\\ ${s2} & ${c2}`),
    keywords: "rotation",
  },
  {
    type: "RZ", symbol: "Rz", name: "R-Z", category: "single", arity: 1, params: [THETA],
    color: "var(--gate-rot)", variant: "outline",
    description: "Rotates the state by θ around the Z axis — changes relative phase only.",
    matrix: bm("e^{-i\\theta/2} & 0 \\\\ 0 & e^{i\\theta/2}"),
    keywords: "rotation phase",
  },
  {
    type: "U", symbol: "U", name: "U Gate", category: "single", arity: 1,
    params: [THETA, PHI, LAMBDA],
    color: "var(--gate-U)", variant: "solid",
    description: "General single-qubit rotation with Euler angles θ, φ, λ.",
    matrix: bm(
      `${c2} & -e^{i\\lambda}${s2} \\\\ e^{i\\phi}${s2} & e^{i(\\phi+\\lambda)}${c2}`
    ),
    keywords: "universal euler",
  },
  {
    type: "P", symbol: "P", name: "Phase", category: "single", arity: 1, params: [THETA],
    color: "var(--gate-P)", variant: "solid",
    description: "Adds a phase of e^{iθ} to |1⟩. S and T are special cases.",
    matrix: bm("1 & 0 \\\\ 0 & e^{i\\theta}"),
    keywords: "phase u1",
  },
  {
    type: "SX", symbol: "√X", name: "SX Gate", category: "single", arity: 1, params: [],
    more: true, color: "var(--gate-SX)", variant: "outline",
    description: "Square root of X — two in a row equal one X gate.",
    matrix: `\\tfrac{1}{2}${bm("1+i & 1-i \\\\ 1-i & 1+i")}`,
    keywords: "sqrt x root",
  },
  {
    type: "U3", symbol: "U3", name: "U3", category: "single", arity: 1,
    params: [THETA, PHI, LAMBDA], more: true,
    color: "var(--gate-SX)", variant: "outline",
    description: "Legacy three-parameter rotation — identical to U(θ, φ, λ).",
    matrix: bm(
      `${c2} & -e^{i\\lambda}${s2} \\\\ e^{i\\phi}${s2} & e^{i(\\phi+\\lambda)}${c2}`
    ),
    keywords: "universal euler",
  },
  {
    type: "CX", symbol: "CX", name: "CNOT", category: "multi", arity: 2, params: [],
    color: "var(--gate-CX)", variant: "solid", render: "control-target",
    description: "Flips the target qubit when the control is |1⟩ — the workhorse of entanglement.",
    matrix: bm("1&0&0&0 \\\\ 0&1&0&0 \\\\ 0&0&0&1 \\\\ 0&0&1&0"),
    keywords: "cnot controlled not entangle",
  },
  {
    type: "CZ", symbol: "CZ", name: "Controlled-Z", category: "multi", arity: 2, params: [],
    color: "var(--gate-CX)", variant: "solid", render: "control-control",
    description: "Applies a −1 phase when both qubits are |1⟩. Symmetric in its qubits.",
    matrix: bm("1&0&0&0 \\\\ 0&1&0&0 \\\\ 0&0&1&0 \\\\ 0&0&0&-1"),
    keywords: "controlled phase",
  },
  {
    type: "SWAP", symbol: "SWAP", name: "SWAP", category: "multi", arity: 2, params: [],
    color: "var(--gate-CX)", variant: "solid", render: "swap",
    description: "Exchanges the states of two qubits.",
    matrix: bm("1&0&0&0 \\\\ 0&0&1&0 \\\\ 0&1&0&0 \\\\ 0&0&0&1"),
    keywords: "exchange",
  },
  {
    type: "RXX", symbol: "Rxx", name: "R-XX", category: "multi", arity: 2, params: [THETA],
    more: true, color: "var(--gate-rot)", variant: "outline", render: "box",
    description: "Ising XX interaction: rotates both qubits by θ about X⊗X.",
    matrix: "\\exp\\!\\left(-i\\tfrac{\\theta}{2}\\, X\\otimes X\\right)",
    keywords: "ising interaction",
  },
  {
    type: "RYY", symbol: "Ryy", name: "R-YY", category: "multi", arity: 2, params: [THETA],
    more: true, color: "var(--gate-rot)", variant: "outline", render: "box",
    description: "Ising YY interaction: rotates both qubits by θ about Y⊗Y.",
    matrix: "\\exp\\!\\left(-i\\tfrac{\\theta}{2}\\, Y\\otimes Y\\right)",
    keywords: "ising interaction",
  },
  {
    type: "RZZ", symbol: "Rzz", name: "R-ZZ", category: "multi", arity: 2, params: [THETA],
    more: true, color: "var(--gate-rot)", variant: "outline", render: "box",
    description: "Ising ZZ interaction: a θ phase rotation about Z⊗Z.",
    matrix: "\\exp\\!\\left(-i\\tfrac{\\theta}{2}\\, Z\\otimes Z\\right)",
    keywords: "ising interaction",
  },
  {
    type: "M", symbol: "M", name: "Measure", category: "measure", arity: 1, params: [],
    color: "var(--gate-meas)", variant: "outline",
    description: "Collapses the qubit to |0⟩ or |1⟩ and records the result in a classical bit.",
    matrix: "M_0 = |0\\rangle\\langle 0|,\\quad M_1 = |1\\rangle\\langle 1|",
    keywords: "measurement readout collapse",
  },
];

export const GATES: Record<GateType, GateDef> = Object.fromEntries(
  DEFS.map((d) => [d.type, d])
) as Record<GateType, GateDef>;

export const GATE_LIST: readonly GateDef[] = DEFS;

export function getGate(type: GateType): GateDef {
  return GATES[type];
}

export function isGateType(value: unknown): value is GateType {
  return typeof value === "string" && value in GATES;
}

export function isTwoQubitGate(type: GateType): boolean {
  return GATES[type]?.arity === 2;
}

export function defaultParams(type: GateType): GateParams | undefined {
  const defs = GATES[type].params;
  if (defs.length === 0) return undefined;
  return Object.fromEntries(defs.map((p) => [p.key, p.default])) as GateParams;
}

/** Case-insensitive match against symbol, name, description and keywords. */
export function searchGates(query: string): GateDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...DEFS];
  return DEFS.filter((d) =>
    [d.type, d.symbol, d.name, d.description, d.keywords ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

// ---------------------------------------------------------------------------
// Angle formatting — show common multiples of π symbolically.
// ---------------------------------------------------------------------------

const PI_FRACTIONS: [number, number][] = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 3], [3, 4], [3, 2], [2, 1],
];

export function formatAngle(radians: number): string {
  if (Math.abs(radians) < 1e-9) return "0";
  const sign = radians < 0 ? "−" : "";
  const abs = Math.abs(radians);
  for (const [n, d] of PI_FRACTIONS) {
    if (Math.abs(abs - (n * Math.PI) / d) < 1e-6) {
      const num = n === 1 ? "π" : `${n}π`;
      return d === 1 ? `${sign}${num}` : `${sign}${num}/${d}`;
    }
  }
  return `${sign}${abs.toFixed(2)}`;
}

/** Common angle presets for the inspector. */
export const ANGLE_PRESETS: { label: string; value: number }[] = [
  { label: "π/4", value: Math.PI / 4 },
  { label: "π/2", value: Math.PI / 2 },
  { label: "π", value: Math.PI },
  { label: "−π/2", value: -Math.PI / 2 },
];
