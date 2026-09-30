/**
 * Pure conversion of legacy lesson Markdown (public.lessons.content) into
 * lesson blocks. Legacy lessons are one Markdown string with ```circuit
 * fences (see frontend/src/components/learn/LessonContent.tsx); each fence
 * becomes a Circuit block and the prose between them Markdown blocks.
 */
import { circuitSpecErrors, type CircuitSpec } from './circuitSpec'

export type ImportedBlock =
  | { blockType: 'markdown'; body: string }
  | { blockType: 'circuit'; spec: CircuitSpec }

const CIRCUIT_FENCE = /^```circuit[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm

// Legacy fences predate the canonical spec: they spell CX as CNOT and omit
// classical_bits. Anything else is left for the validator to judge.
const GATE_ALIASES: Record<string, string> = { CNOT: 'CX' }

export function normalizeLegacyCircuit(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  const spec = raw as Record<string, unknown>
  const gates = Array.isArray(spec.gates)
    ? spec.gates.map((g) => {
        if (typeof g !== 'object' || g === null) return g
        const gate = g as Record<string, unknown>
        const type = typeof gate.type === 'string' ? gate.type.toUpperCase() : gate.type
        return { ...gate, type: typeof type === 'string' ? (GATE_ALIASES[type] ?? type) : type }
      })
    : spec.gates
  const measures = Array.isArray(gates) && gates.some((g) => (g as { type?: unknown })?.type === 'M')
  return {
    qubits: spec.qubits,
    classical_bits: spec.classical_bits ?? (measures ? spec.qubits : 0),
    gates,
  }
}

export type Conversion = { blocks: ImportedBlock[]; warnings: string[] }

export function legacyMarkdownToBlocks(markdown: string | null | undefined): Conversion {
  const source = (markdown ?? '').replace(/\r\n/g, '\n')
  const blocks: ImportedBlock[] = []
  const warnings: string[] = []

  const pushMarkdown = (text: string) => {
    const body = text.trim()
    if (!body) return
    const last = blocks[blocks.length - 1]
    if (last?.blockType === 'markdown') last.body = `${last.body}\n\n${body}`
    else blocks.push({ blockType: 'markdown', body })
  }

  let cursor = 0
  for (const match of source.matchAll(CIRCUIT_FENCE)) {
    pushMarkdown(source.slice(cursor, match.index))
    cursor = match.index + match[0].length

    let parsed: unknown
    try {
      parsed = JSON.parse(match[1])
    } catch {
      warnings.push('Unparseable circuit fence kept as Markdown')
      pushMarkdown(match[0])
      continue
    }
    const spec = normalizeLegacyCircuit(parsed)
    const errors = circuitSpecErrors(spec)
    if (errors.length) {
      warnings.push(`Invalid circuit fence kept as Markdown: ${errors.join('; ')}`)
      pushMarkdown(match[0])
      continue
    }
    blocks.push({ blockType: 'circuit', spec: spec as CircuitSpec })
  }
  pushMarkdown(source.slice(cursor))

  return { blocks, warnings }
}

/**
 * Step 4 of the migration: check a conversion against its source. Every
 * non-whitespace character outside circuit fences must survive, and every
 * fence must be accounted for.
 */
export function verifyConversion(markdown: string | null | undefined, blocks: ImportedBlock[]): string[] {
  const source = (markdown ?? '').replace(/\r\n/g, '\n')
  const squash = (s: string) => s.replace(/\s+/g, '')
  const fences = [...source.matchAll(CIRCUIT_FENCE)]
  const circuits = blocks.filter((b) => b.blockType === 'circuit').length
  const problems: string[] = []

  const prose = squash(source.replace(CIRCUIT_FENCE, ''))
  const rebuilt = squash(
    blocks
      .filter((b): b is Extract<ImportedBlock, { blockType: 'markdown' }> => b.blockType === 'markdown')
      .map((b) => b.body.replace(CIRCUIT_FENCE, ''))
      .join(''),
  )
  if (prose !== rebuilt) problems.push('Markdown prose differs from the source')

  const keptAsMarkdown = blocks
    .filter((b) => b.blockType === 'markdown')
    .reduce((n, b) => n + [...(b as { body: string }).body.matchAll(CIRCUIT_FENCE)].length, 0)
  if (circuits + keptAsMarkdown !== fences.length) {
    problems.push(`Expected ${fences.length} circuit fence(s), found ${circuits + keptAsMarkdown}`)
  }
  if (source.trim() && blocks.length === 0) problems.push('Non-empty lesson produced no blocks')
  return problems
}
