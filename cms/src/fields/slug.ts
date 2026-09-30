import type { NumberField, TextField } from 'payload'

export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** URL slug, derived from `title` when left blank. */
export const slugField = (): TextField => ({
  name: 'slug',
  type: 'text',
  required: true,
  index: true,
  admin: { position: 'sidebar', description: 'Derived from the title when left blank.' },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === 'string' && value.trim()) return slugify(value)
        const title = data?.title
        return typeof title === 'string' ? slugify(title) : value
      },
    ],
  },
})

/** Sort position among siblings (ascending). */
export const orderField = (): NumberField => ({
  name: 'order',
  type: 'number',
  required: true,
  defaultValue: 0,
  admin: { position: 'sidebar' },
})
