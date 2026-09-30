/**
 * Server-to-server calls from the CMS to the rest of Q-Learn. Both are
 * best-effort: a failure is logged and never blocks an author's save.
 */
const TIMEOUT_MS = 10_000

export type RegisterResult = { id: string; kind: string; payload_id: string }

/** POST /api/v1/internal/content-refs on the FastAPI backend. */
export async function registerLessonRef(
  payloadId: string,
  refId: string | null | undefined,
): Promise<RegisterResult> {
  const base = process.env.BACKEND_API_URL
  const secret = process.env.CMS_WEBHOOK_SECRET
  if (!base || !secret) throw new Error('BACKEND_API_URL / CMS_WEBHOOK_SECRET not configured')

  const res = await fetch(`${base.replace(/\/$/, '')}/api/v1/internal/content-refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CMS-Secret': secret },
    body: JSON.stringify({ kind: 'lesson', payload_id: payloadId, ref_id: refId || null }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: RegisterResult; error?: { message?: string } }
    | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(`content-ref registration failed (${res.status}): ${json?.error?.message ?? 'no body'}`)
  }
  return json.data
}

export type RevalidatePayload = {
  collection: string
  id: string | number
  contentRefId?: string | null
}

/** POST /api/revalidate on the student app (frontend/). */
export async function revalidateStudentAppContent(body: RevalidatePayload): Promise<void> {
  const base = process.env.STUDENT_APP_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!base || !secret) throw new Error('STUDENT_APP_URL / REVALIDATE_SECRET not configured')

  const res = await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Revalidate-Secret': secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`revalidate failed (${res.status})`)
}
