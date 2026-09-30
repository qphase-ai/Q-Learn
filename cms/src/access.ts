import type { Access, FieldAccess, PayloadRequest } from 'payload'

/**
 * CMS roles are isolated from Supabase Auth (v1): `author` maps conceptually
 * onto the backend's `instructor`, `publisher` onto `admin`.
 */
export type CmsRole = 'author' | 'publisher'

type CmsUserLike = { collection?: string; role?: CmsRole | null }

export const cmsUser = (req: PayloadRequest): CmsUserLike | null => {
  const user = req.user as CmsUserLike | null | undefined
  return user && user.collection === 'cmsUsers' ? user : null
}

export const isPublisher = (req: PayloadRequest): boolean => cmsUser(req)?.role === 'publisher'

export const authenticated: Access = ({ req }) => Boolean(cmsUser(req))

export const publishers: Access = ({ req }) => isPublisher(req)

export const publisherField: FieldAccess = ({ req }) => isPublisher(req)

/** Students (anonymous REST) see published documents only; CMS users see drafts too. */
export const publishedOrAuthenticated: Access = ({ req }) => {
  if (cmsUser(req)) return true
  return { _status: { equals: 'published' } }
}
