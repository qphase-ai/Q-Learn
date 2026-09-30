import type { CollectionConfig, CollectionSlug, Field } from 'payload'

import { authenticated, publishedOrAuthenticated, publishers } from '../access'
import { enforcePublishRole } from '../hooks/enforcePublishRole'
import { revalidateStudentApp, revalidateStudentAppOnDelete } from '../hooks/revalidate'

/** Shared configuration for Curriculum → Level → Module → Lesson. */
export function contentCollection(
  config: Omit<CollectionConfig, 'access' | 'versions'> & { parent?: { name: string; relationTo: CollectionSlug } },
): CollectionConfig {
  const { parent, fields, hooks, admin, ...rest } = config
  const parentField: Field[] = parent
    ? [{ name: parent.name, type: 'relationship', relationTo: parent.relationTo, required: true, index: true }]
    : []
  return {
    ...rest,
    admin: { useAsTitle: 'title', group: 'Curriculum', ...admin },
    access: {
      read: publishedOrAuthenticated,
      create: authenticated,
      update: authenticated,
      delete: publishers,
    },
    versions: { drafts: true, maxPerDoc: 50 },
    fields: [...parentField, ...fields],
    hooks: {
      ...hooks,
      beforeChange: [enforcePublishRole, ...(hooks?.beforeChange ?? [])],
      afterChange: [...(hooks?.afterChange ?? []), revalidateStudentApp],
      afterDelete: [...(hooks?.afterDelete ?? []), revalidateStudentAppOnDelete],
    },
  }
}
