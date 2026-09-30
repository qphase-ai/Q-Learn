import { lessonBlocks } from '../blocks/lessonBlocks'
import { orderField, slugField } from '../fields/slug'
import { registerContentRef } from '../hooks/registerContentRef'
import { contentCollection } from './content'

export const Lessons = contentCollection({
  slug: 'lessons',
  parent: { name: 'module', relationTo: 'modules' },
  admin: { defaultColumns: ['title', 'module', 'order', '_status'] },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    { name: 'description', type: 'textarea' },
    { name: 'objectives', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
    { name: 'estimatedTime', type: 'number', min: 0, admin: { description: 'Minutes.' } },
    {
      name: 'difficulty',
      type: 'select',
      defaultValue: 'beginner',
      options: ['beginner', 'intermediate', 'advanced'].map((v) => ({ label: v, value: v })),
    },
    orderField(),
    { name: 'blocks', type: 'blocks', blocks: lessonBlocks, required: true, minRows: 1 },
    {
      // Backend-owned content_refs.id. Learner state (progress, quiz
      // attempts) is keyed by this, never by the Payload id. Set on first
      // publish by registerContentRef; the legacy import presets it.
      name: 'contentRefId',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Assigned by the Q-Learn backend on first publish.',
      },
    },
  ],
  hooks: {
    afterChange: [registerContentRef],
  },
})
