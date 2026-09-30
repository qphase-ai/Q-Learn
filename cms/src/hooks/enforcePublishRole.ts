import { Forbidden, type CollectionBeforeChangeHook } from 'payload'

import { cmsUser, isPublisher } from '../access'

/**
 * Authors save drafts; only publishers change what students see. Draft saves
 * (`?draft=true`) write only a version; any other save of a published
 * document rewrites the live copy — publishing changes or, with
 * `_status: 'draft'`, unpublishing it. Local API calls without a user
 * (scripts, the legacy import) are trusted.
 */
export const enforcePublishRole: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!cmsUser(req) || isPublisher(req)) return data
  // Payload >= 3.63 may parse query flags as booleans.
  const draftSave = req.query?.draft === true || req.query?.draft === 'true'
  if (data?._status === 'published') throw new Forbidden(req.t)
  if (!draftSave && originalDoc?._status === 'published') throw new Forbidden(req.t)
  return data
}
