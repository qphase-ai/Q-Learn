import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { revalidateStudentAppContent, type RevalidatePayload } from './backend'

async function notify(req: PayloadRequest, body: RevalidatePayload) {
  try {
    await revalidateStudentAppContent(body)
  } catch (err) {
    req.payload.logger.warn(
      { ...body, error: err instanceof Error ? err.message : String(err) },
      'student app revalidation failed',
    )
  }
}

/**
 * Invalidate the student app's cached copy when published content changes —
 * on publish, on edits to published docs, and on unpublish. Draft-only saves
 * are invisible to students and skipped.
 */
export const revalidateStudentApp: CollectionAfterChangeHook = async ({
  collection,
  doc,
  previousDoc,
  req,
}) => {
  if (doc._status === 'published' || previousDoc?._status === 'published') {
    await notify(req, { collection: collection.slug, id: doc.id, contentRefId: doc.contentRefId })
  }
  return doc
}

export const revalidateStudentAppOnDelete: CollectionAfterDeleteHook = async ({ collection, doc, req }) => {
  await notify(req, { collection: collection.slug, id: doc.id, contentRefId: doc.contentRefId })
  return doc
}
