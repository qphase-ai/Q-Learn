import type { CollectionConfig } from 'payload'

import { authenticated } from '../access'

/**
 * Lesson media. Stored in Supabase Storage via the S3 adapter when S3_* is
 * configured (see payload.config.ts), on local disk otherwise.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content' },
  access: {
    // Lesson images are part of published content; files themselves are
    // served through signed URLs when S3 storage is enabled.
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [{ name: 'alt', type: 'text', required: true }],
  upload: {
    mimeTypes: ['image/*'],
  },
}
