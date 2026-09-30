import type { CollectionAfterChangeHook } from 'payload'

import { registerLessonRef } from './backend'

export const SKIP_CONTENT_REF_SYNC = 'skipContentRefSync'

/**
 * On publish, resolve the lesson's backend-owned content_refs id and store it
 * on the document, so the student app can key learner state by it.
 * Idempotent on the backend; only writes back when the id changes.
 */
export const registerContentRef: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  if (context[SKIP_CONTENT_REF_SYNC] || doc._status !== 'published') return doc

  try {
    const ref = await registerLessonRef(String(doc.id), doc.contentRefId)
    if (ref.id === doc.contentRefId) return doc

    await req.payload.update({
      collection: 'lessons',
      id: doc.id,
      data: { contentRefId: ref.id },
      context: { [SKIP_CONTENT_REF_SYNC]: true },
      depth: 0,
      req,
    })
    return { ...doc, contentRefId: ref.id }
  } catch (err) {
    // Not fatal: the lesson is published but students cannot record progress
    // on it until a later publish registers it.
    req.payload.logger.error({ err, lessonId: doc.id }, 'content_ref registration failed')
    return doc
  }
}
