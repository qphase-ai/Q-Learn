import type { CollectionConfig } from 'payload'

import { authenticated, isPublisher, publisherField, publishers } from '../access'

/**
 * Payload admin accounts — isolated from Supabase Auth (students never log in
 * here). `author` drafts content; `publisher` also publishes and manages users.
 */
export const CmsUsers: CollectionConfig = {
  slug: 'cmsUsers',
  labels: { singular: 'CMS user', plural: 'CMS users' },
  auth: true,
  admin: { useAsTitle: 'email', group: 'Admin' },
  access: {
    read: authenticated,
    create: publishers,
    update: ({ req, id }) => isPublisher(req) || (Boolean(req.user) && req.user?.id === id),
    delete: publishers,
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'author',
      saveToJWT: true,
      options: [
        { label: 'Author', value: 'author' },
        { label: 'Publisher', value: 'publisher' },
      ],
      access: { create: publisherField, update: publisherField },
    },
  ],
  hooks: {
    beforeChange: [
      // The first account (created through the admin's first-user screen)
      // must be able to publish, or nobody ever could.
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        const { totalDocs } = await req.payload.count({ collection: 'cmsUsers', req })
        return totalDocs === 0 ? { ...data, role: 'publisher' } : data
      },
    ],
  },
}
