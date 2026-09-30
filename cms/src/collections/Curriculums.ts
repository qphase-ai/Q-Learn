import { slugField } from '../fields/slug'
import { contentCollection } from './content'

export const Curriculums = contentCollection({
  slug: 'curriculums',
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    { name: 'description', type: 'textarea' },
  ],
})
