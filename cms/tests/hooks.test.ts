import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enforcePublishRole } from '../src/hooks/enforcePublishRole'
import { registerContentRef, SKIP_CONTENT_REF_SYNC } from '../src/hooks/registerContentRef'
import { revalidateStudentApp } from '../src/hooks/revalidate'

const fetchMock = vi.fn()

function fakeReq(user?: { role: string }, query: Record<string, unknown> = {}) {
  return {
    user: user ? { collection: 'cmsUsers', ...user } : null,
    query,
    t: (k: string) => k,
    payload: {
      update: vi.fn().mockResolvedValue({}),
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    },
  }
}

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('BACKEND_API_URL', 'http://api:8000/')
  vi.stubEnv('CMS_WEBHOOK_SECRET', 'cms-secret')
  vi.stubEnv('STUDENT_APP_URL', 'http://web:3000')
  vi.stubEnv('REVALIDATE_SECRET', 'rv-secret')
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// Hooks are invoked with a subset of Payload's args; cast at the boundary.
const call = (hook: (args: never) => unknown, args: Record<string, unknown>) => hook(args as never)

describe('registerContentRef', () => {
  it('registers a published lesson and stores the minted ref id', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'ref-1', kind: 'lesson', payload_id: '7' }))
    const req = fakeReq()
    const doc = { id: 7, _status: 'published', contentRefId: null }

    const result = await call(registerContentRef, { doc, req, context: {} })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api:8000/api/v1/internal/content-refs')
    expect(init.headers['X-CMS-Secret']).toBe('cms-secret')
    expect(JSON.parse(init.body)).toEqual({ kind: 'lesson', payload_id: '7', ref_id: null })
    expect(req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'lessons',
        id: 7,
        data: { contentRefId: 'ref-1' },
        context: { [SKIP_CONTENT_REF_SYNC]: true },
      }),
    )
    expect(result).toMatchObject({ contentRefId: 'ref-1' })
  })

  it('sends an existing ref id and skips the write-back when unchanged', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'legacy-uuid', kind: 'lesson', payload_id: '7' }))
    const req = fakeReq()

    await call(registerContentRef, { doc: { id: 7, _status: 'published', contentRefId: 'legacy-uuid' }, req, context: {} })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).ref_id).toBe('legacy-uuid')
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it.each([
    ['drafts', { id: 7, _status: 'draft' }, {}],
    ['its own write-back', { id: 7, _status: 'published' }, { [SKIP_CONTENT_REF_SYNC]: true }],
  ])('ignores %s', async (_label, doc, context) => {
    await call(registerContentRef, { doc, req: fakeReq(), context })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs and keeps the save when the backend fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ success: false, error: { message: 'taken' } }) })
    const req = fakeReq()
    const doc = { id: 7, _status: 'published' }

    expect(await call(registerContentRef, { doc, req, context: {} })).toBe(doc)
    expect(req.payload.logger.error).toHaveBeenCalled()
  })
})

describe('enforcePublishRole', () => {
  const draft = { draft: 'true' }
  it.each([
    ['publisher publishing', { role: 'publisher' }, {}, { _status: 'published' }, undefined, true],
    ['publisher unpublishing', { role: 'publisher' }, {}, { _status: 'draft' }, { _status: 'published' }, true],
    ['author saving a draft of a published doc', { role: 'author' }, draft, { _status: 'draft' }, { _status: 'published' }, true],
    ['author saving a draft (boolean query flag)', { role: 'author' }, { draft: true }, { _status: 'draft' }, { _status: 'published' }, true],
    ['author editing a never-published doc', { role: 'author' }, {}, { title: 'x' }, { _status: 'draft' }, true],
    ['local API without a user', undefined, {}, { _status: 'published' }, undefined, true],
    ['author publishing', { role: 'author' }, {}, { _status: 'published' }, undefined, false],
    ['author publishing via a draft request', { role: 'author' }, draft, { _status: 'published' }, { _status: 'draft' }, false],
    ['author editing a published doc without drafting', { role: 'author' }, {}, { title: 'x' }, { _status: 'published' }, false],
    ['author unpublishing', { role: 'author' }, {}, { _status: 'draft' }, { _status: 'published' }, false],
  ])('%s', (_label, user, query, data, originalDoc, allowed) => {
    const run = () => call(enforcePublishRole, { data, originalDoc, req: fakeReq(user, query) })
    if (allowed) expect(run()).toBe(data)
    else expect(run).toThrow()
  })
})

describe('revalidateStudentApp', () => {
  const collection = { slug: 'lessons' }

  it('notifies the student app when published content changes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const doc = { id: 3, _status: 'published', contentRefId: 'ref-3' }

    await call(revalidateStudentApp, { collection, doc, previousDoc: null, req: fakeReq() })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://web:3000/api/revalidate')
    expect(init.headers['X-Revalidate-Secret']).toBe('rv-secret')
    expect(JSON.parse(init.body)).toEqual({ collection: 'lessons', id: 3, contentRefId: 'ref-3' })
  })

  it('notifies on unpublish and skips draft-only saves', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    await call(revalidateStudentApp, { collection, doc: { id: 3, _status: 'draft' }, previousDoc: { _status: 'published' }, req: fakeReq() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await call(revalidateStudentApp, { collection, doc: { id: 3, _status: 'draft' }, previousDoc: { _status: 'draft' }, req: fakeReq() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never fails the save', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const req = fakeReq()
    const doc = { id: 3, _status: 'published' }
    expect(await call(revalidateStudentApp, { collection, doc, previousDoc: null, req })).toBe(doc)
    expect(req.payload.logger.warn).toHaveBeenCalled()
  })
})
