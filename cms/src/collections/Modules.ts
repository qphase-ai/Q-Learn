import { orderField, slugField } from '../fields/slug'
import { contentCollection } from './content'

export const Modules = contentCollection({
  slug: 'modules',
  parent: { name: 'level', relationTo: 'levels' },
  admin: { defaultColumns: ['title', 'level', 'order', '_status'] },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    { name: 'description', type: 'textarea' },
    orderField(),
  ],
})
