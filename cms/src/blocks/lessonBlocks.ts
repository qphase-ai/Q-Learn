import type { Block } from 'payload'

import { validateCircuitSpec } from '../lib/circuitSpec'

/**
 * The closed lesson-block registry. Adding a block type is a deliberate change
 * made together with the student renderer (frontend/src/components/learn/blocks).
 * The `slug` is the `blockType` the frontend switches on.
 */

export const HeadingBlock: Block = {
  slug: 'heading',
  interfaceName: 'HeadingBlock',
  fields: [
    { name: 'text', type: 'text', required: true },
    {
      name: 'level',
      type: 'select',
      required: true,
      defaultValue: '2',
      options: [
        { label: 'H2', value: '2' },
        { label: 'H3', value: '3' },
        { label: 'H4', value: '4' },
      ],
    },
  ],
}

export const TextBlock: Block = {
  slug: 'text',
  interfaceName: 'TextBlock',
  fields: [
    {
      name: 'body',
      type: 'textarea',
      required: true,
      admin: { description: 'Plain text. Blank lines separate paragraphs. Use a Markdown block for formatting.' },
    },
  ],
}

export const MarkdownBlock: Block = {
  slug: 'markdown',
  interfaceName: 'MarkdownBlock',
  fields: [
    {
      name: 'body',
      type: 'code',
      required: true,
      admin: {
        language: 'markdown',
        description: 'Markdown with $inline$ and $$display$$ math. Raw HTML is not rendered.',
      },
    },
  ],
}

export const MathBlock: Block = {
  slug: 'math',
  interfaceName: 'MathBlock',
  fields: [
    { name: 'latex', type: 'textarea', required: true, admin: { description: 'LaTeX, without $ delimiters.' } },
    { name: 'displayMode', type: 'checkbox', defaultValue: true },
    { name: 'caption', type: 'text' },
  ],
}

export const ImageBlock: Block = {
  slug: 'image',
  interfaceName: 'ImageBlock',
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    { name: 'caption', type: 'text' },
  ],
}

export const CodeBlock: Block = {
  slug: 'code',
  interfaceName: 'CodeBlock',
  fields: [
    {
      name: 'language',
      type: 'select',
      required: true,
      defaultValue: 'python',
      options: [
        { label: 'Python / Qiskit', value: 'python' },
        { label: 'OpenQASM', value: 'qasm' },
        { label: 'Plain text', value: 'text' },
      ],
    },
    { name: 'filename', type: 'text' },
    { name: 'code', type: 'code', required: true },
    { name: 'caption', type: 'text' },
  ],
}

export const CalloutBlock: Block = {
  slug: 'callout',
  interfaceName: 'CalloutBlock',
  fields: [
    {
      name: 'variant',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: ['info', 'tip', 'warning', 'important'].map((v) => ({ label: v, value: v })),
    },
    { name: 'title', type: 'text' },
    { name: 'body', type: 'textarea', required: true, admin: { description: 'Markdown.' } },
  ],
}

export const CircuitBlock: Block = {
  slug: 'circuit',
  interfaceName: 'CircuitBlock',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    {
      name: 'spec',
      type: 'json',
      required: true,
      validate: validateCircuitSpec,
      admin: {
        description:
          'Canonical CircuitSpec: { "qubits": 2, "classical_bits": 2, "gates": [{ "type": "H", "targets": [0] }] }',
      },
    },
  ],
}

export const QuizBlock: Block = {
  slug: 'quiz',
  interfaceName: 'QuizBlock',
  fields: [
    { name: 'question', type: 'textarea', required: true },
    {
      name: 'questionType',
      type: 'select',
      required: true,
      defaultValue: 'multiple_choice',
      options: [
        { label: 'Multiple choice', value: 'multiple_choice' },
        { label: 'True / false', value: 'true_false' },
      ],
    },
    {
      name: 'options',
      type: 'array',
      minRows: 2,
      required: true,
      fields: [{ name: 'text', type: 'text', required: true }],
    },
    {
      name: 'correctAnswer',
      type: 'text',
      required: true,
      admin: { description: 'Must exactly match one option.' },
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
        const options = Array.isArray(siblingData?.options)
          ? (siblingData.options as { text?: string }[]).map((o) => o?.text)
          : []
        if (typeof value !== 'string' || !value) return 'Correct answer is required'
        return options.includes(value) || 'Correct answer must exactly match one of the options'
      },
    },
    { name: 'hint', type: 'textarea' },
    { name: 'explanation', type: 'textarea' },
    {
      name: 'difficulty',
      type: 'select',
      defaultValue: 'beginner',
      options: ['beginner', 'intermediate', 'advanced'].map((v) => ({ label: v, value: v })),
    },
    { name: 'concept', type: 'text', admin: { description: 'Concept name this question assesses (metadata).' } },
  ],
}

export const SimulationBlock: Block = {
  slug: 'simulation',
  interfaceName: 'SimulationBlock',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    {
      name: 'view',
      type: 'select',
      required: true,
      defaultValue: 'probabilities',
      options: [
        { label: 'Measurement probabilities', value: 'probabilities' },
        { label: 'State vector', value: 'statevector' },
      ],
    },
    {
      name: 'circuit',
      type: 'json',
      required: true,
      validate: validateCircuitSpec,
      admin: { description: 'CircuitSpec to execute. The CMS stores configuration only and never runs it.' },
    },
    { name: 'shots', type: 'number', required: true, defaultValue: 1024, min: 1, max: 8192 },
  ],
}

export const lessonBlocks: Block[] = [
  HeadingBlock,
  TextBlock,
  MarkdownBlock,
  MathBlock,
  ImageBlock,
  CodeBlock,
  CalloutBlock,
  CircuitBlock,
  QuizBlock,
  SimulationBlock,
]
