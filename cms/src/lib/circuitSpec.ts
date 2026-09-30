/**
 * The canonical CircuitSpec — byte-identical to frontend/src/types/index.ts
 * and backend/app/schemas/circuit.py. There is exactly one circuit
 * representation in Q-Learn; the CMS stores it verbatim.
 *
 * This validator is authoring UX only. Authored circuits are not trusted
 * input: FastAPI runs QuantumBackend.validate() before compile/execute.
 */
export interface GateSpec {
  type: string
  targets: number[]
  control?: number
  params?: Record<string, unknown>
  classical?: number[]
}

export interface CircuitSpec {
  qubits: number
  classical_bits: number
  gates: GateSpec[]
}

// Gates the backend's QASM compiler maps (backend/app/quantum/sandbox_adapter.py).
export const SUPPORTED_GATES = ['H', 'X', 'Y', 'Z', 'S', 'T', 'I', 'CX', 'CZ', 'SWAP', 'M'] as const
const CONTROLLED_GATES = new Set(['CX', 'CZ'])
export const MAX_QUBITS = 29

const GATE_KEYS = new Set(['type', 'targets', 'control', 'params', 'classical'])
const SPEC_KEYS = new Set(['qubits', 'classical_bits', 'gates'])

const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Returns a list of human-readable problems; empty means valid. */
export function circuitSpecErrors(value: unknown): string[] {
  if (!isPlainObject(value)) return ['Circuit must be a JSON object']
  const errors: string[] = []

  for (const key of Object.keys(value)) {
    if (!SPEC_KEYS.has(key)) errors.push(`Unknown circuit field "${key}"`)
  }

  const { qubits, classical_bits: classicalBits, gates } = value
  if (!Number.isInteger(qubits) || (qubits as number) < 1 || (qubits as number) > MAX_QUBITS) {
    errors.push(`qubits must be an integer between 1 and ${MAX_QUBITS}`)
  }
  if (!isIndex(classicalBits)) errors.push('classical_bits must be a non-negative integer')
  if (!Array.isArray(gates)) {
    errors.push('gates must be an array')
    return errors
  }

  const nQubits = Number.isInteger(qubits) ? (qubits as number) : 0
  const nClassical = isIndex(classicalBits) ? classicalBits : 0
  const inQubitRange = (i: unknown) => isIndex(i) && i < nQubits

  gates.forEach((gate, i) => {
    const at = `gates[${i}]`
    if (!isPlainObject(gate)) {
      errors.push(`${at} must be an object`)
      return
    }
    for (const key of Object.keys(gate)) {
      if (!GATE_KEYS.has(key)) errors.push(`${at}: unknown field "${key}"`)
    }
    const { type, targets, control, params, classical } = gate
    if (typeof type !== 'string' || !(SUPPORTED_GATES as readonly string[]).includes(type)) {
      errors.push(`${at}: type must be one of ${SUPPORTED_GATES.join(', ')}`)
    }
    if (!Array.isArray(targets) || targets.length === 0 || !targets.every(inQubitRange)) {
      errors.push(`${at}: targets must be a non-empty array of qubit indices < ${nQubits}`)
    }
    if (control !== undefined && control !== null) {
      if (!inQubitRange(control)) errors.push(`${at}: control must be a qubit index < ${nQubits}`)
      else if (Array.isArray(targets) && targets.includes(control)) {
        errors.push(`${at}: control cannot also be a target`)
      }
    } else if (typeof type === 'string' && CONTROLLED_GATES.has(type)) {
      errors.push(`${at}: ${type} requires a control qubit`)
    }
    if (type === 'SWAP' && (!Array.isArray(targets) || targets.length !== 2)) {
      errors.push(`${at}: SWAP needs exactly two targets`)
    }
    if (params !== undefined && params !== null && !isPlainObject(params)) {
      errors.push(`${at}: params must be an object`)
    }
    if (classical !== undefined && classical !== null) {
      if (!Array.isArray(classical) || !classical.every((c) => isIndex(c) && c < nClassical)) {
        errors.push(`${at}: classical must be bit indices < classical_bits (${nClassical})`)
      }
    } else if (type === 'M' && Array.isArray(targets) && !targets.every((t) => isIndex(t) && t < nClassical)) {
      errors.push(`${at}: measuring without "classical" needs classical_bits > each target`)
    }
  })

  return errors
}

/** Payload field `validate` adapter. */
export function validateCircuitSpec(value: unknown): true | string {
  if (value === null || value === undefined) return true // `required` handles absence
  const errors = circuitSpecErrors(value)
  return errors.length === 0 ? true : errors.slice(0, 5).join('; ')
}
