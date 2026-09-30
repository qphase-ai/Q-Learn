import { describe, expect, it } from 'vitest'

import { legacyMarkdownToBlocks, normalizeLegacyCircuit, verifyConversion } from '../src/lib/legacyImport'

const fence = (body: string) => '```circuit\n' + body + '\n```'

describe('legacyMarkdownToBlocks', () => {
  it('keeps a fence-free lesson as one Markdown block', () => {
    const { blocks, warnings } = legacyMarkdownToBlocks('# Superposition\n\nA qubit.')
    expect(blocks).toEqual([{ blockType: 'markdown', body: '# Superposition\n\nA qubit.' }])
    expect(warnings).toEqual([])
  })

  it('splits circuit fences into canonical Circuit blocks between Markdown blocks', () => {
    const src = `# Bell\n\nThe circuit:\n\n${fence('{"qubits": 2, "gates": [{"type": "H", "targets": [0]}, {"type": "CNOT", "control": 0, "targets": [1]}]}')}\n\n## After`
    const { blocks } = legacyMarkdownToBlocks(src)
    expect(blocks).toEqual([
      { blockType: 'markdown', body: '# Bell\n\nThe circuit:' },
      {
        blockType: 'circuit',
        spec: {
          qubits: 2,
          classical_bits: 0,
          gates: [
            { type: 'H', targets: [0] },
            { type: 'CX', control: 0, targets: [1] },
          ],
        },
      },
      { blockType: 'markdown', body: '## After' },
    ])
    expect(verifyConversion(src, blocks)).toEqual([])
  })

  it('keeps unparseable or invalid fences as Markdown, with a warning', () => {
    const src = `Intro\n\n${fence('{not json')}\n\n${fence('{"qubits": 1, "gates": [{"type": "H", "targets": [4]}]}')}`
    const { blocks, warnings } = legacyMarkdownToBlocks(src)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].blockType).toBe('markdown')
    expect(warnings).toHaveLength(2)
    expect(verifyConversion(src, blocks)).toEqual([])
  })

  it('handles empty content', () => {
    expect(legacyMarkdownToBlocks(null).blocks).toEqual([])
    expect(verifyConversion(null, [])).toEqual([])
  })
})

describe('normalizeLegacyCircuit', () => {
  it('gives measured circuits a classical register', () => {
    expect(normalizeLegacyCircuit({ qubits: 2, gates: [{ type: 'm', targets: [0] }] })).toEqual({
      qubits: 2,
      classical_bits: 2,
      gates: [{ type: 'M', targets: [0] }],
    })
  })
})

describe('verifyConversion', () => {
  it('flags lost prose and missing circuits', () => {
    const src = `Keep me\n\n${fence('{"qubits": 1, "classical_bits": 0, "gates": []}')}`
    expect(verifyConversion(src, [{ blockType: 'markdown', body: 'Something else' }])).toEqual([
      'Markdown prose differs from the source',
      'Expected 1 circuit fence(s), found 0',
    ])
  })
})
