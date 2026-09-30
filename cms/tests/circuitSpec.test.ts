import { describe, expect, it } from 'vitest'

import { circuitSpecErrors, validateCircuitSpec } from '../src/lib/circuitSpec'

const bell = {
  qubits: 2,
  classical_bits: 2,
  gates: [
    { type: 'H', targets: [0] },
    { type: 'CX', control: 0, targets: [1] },
    { type: 'M', targets: [0, 1], classical: [0, 1] },
  ],
}

describe('circuitSpecErrors', () => {
  it('accepts the canonical CircuitSpec', () => {
    expect(circuitSpecErrors(bell)).toEqual([])
    expect(validateCircuitSpec(bell)).toBe(true)
  })

  it('accepts gate params (backend GateSpec.params)', () => {
    expect(circuitSpecErrors({ ...bell, gates: [{ type: 'H', targets: [0], params: { theta: 1 } }] })).toEqual([])
  })

  it.each([
    ['non-object', 'nope', /JSON object/],
    ['too many qubits', { ...bell, qubits: 30 }, /between 1 and 29/],
    ['missing classical_bits', { qubits: 1, gates: [] }, /classical_bits/],
    ['unknown top-level key', { ...bell, name: 'x' }, /Unknown circuit field "name"/],
    ['unsupported gate', { ...bell, gates: [{ type: 'CNOT', control: 0, targets: [1] }] }, /type must be one of/],
    ['target out of range', { ...bell, gates: [{ type: 'H', targets: [2] }] }, /qubit indices < 2/],
    ['CX without control', { ...bell, gates: [{ type: 'CX', targets: [1] }] }, /requires a control/],
    ['control equals target', { ...bell, gates: [{ type: 'CZ', control: 1, targets: [1] }] }, /cannot also be a target/],
    ['SWAP arity', { ...bell, gates: [{ type: 'SWAP', targets: [0] }] }, /exactly two targets/],
    ['classical out of range', { ...bell, gates: [{ type: 'M', targets: [0], classical: [5] }] }, /classical must be bit indices/],
    ['measure with no classical bits', { qubits: 1, classical_bits: 0, gates: [{ type: 'M', targets: [0] }] }, /classical_bits > each target/],
    ['unknown gate key', { ...bell, gates: [{ type: 'H', targets: [0], angle: 1 }] }, /unknown field "angle"/],
  ])('rejects %s', (_label, spec, message) => {
    const errors = circuitSpecErrors(spec)
    expect(errors.join('\n')).toMatch(message)
    expect(validateCircuitSpec(spec)).not.toBe(true)
  })

  it('leaves absence to `required`', () => {
    expect(validateCircuitSpec(undefined)).toBe(true)
  })
})
