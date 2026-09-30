import { orderField, slugField } from '../fields/slug'
import { contentCollection } from './content'

/** One of the 20 levels (0–19) in docs/Curriculum/Q-Learn-quantum-curriculum.md. */
export const Levels = contentCollection({
  slug: 'levels',
  parent: { name: 'curriculum', relationTo: 'curriculums' },
  admin: { defaultColumns: ['title', 'levelNumber', 'curriculum', '_status'] },
  fields: [
    { name: 'levelNumber', type: 'number', required: true, min: 0, max: 19, index: true },
    { name: 'title', type: 'text', required: true },
    slugField(),
    { name: 'description', type: 'textarea' },
    { name: 'objectives', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
    { name: 'estimatedHours', type: 'number', min: 0 },
    { name: 'badge', type: 'text' },
    orderField(),
  ],
})
