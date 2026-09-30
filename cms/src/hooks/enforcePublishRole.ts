import { Forbidden, type CollectionBeforeChangeHook } from 'payload'

import { cmsUser, isPublisher } from '../access'

/**
 * Authors save drafts; only publishers change what students see. A non-draft
 * save of an already-published document counts as publishing. Local API calls
 * without a user (scripts, the legacy import) are trusted.
 */
export const enforcePublishRole: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!cmsUser(req) || isPublisher(req)) return data
  const status = data?._status ?? originalDoc?._status
  if (status === 'published') throw new Forbidden(req.t)
  return data
}
