/**
 * Migration step 3–4 (docs/Curriculum/cirrculum-store-architecture.md):
 * import the legacy curriculum exported by
 * `backend/scripts/export_legacy_curriculum.py` into Payload, then bind each
 * lesson's content_refs row and validate the result.
 *
 *   pnpm import:legacy ../backend/legacy-curriculum.json
 *
 * Mapping: course → Curriculum; each legacy module → a Level holding one
 * Module of the same title; lesson → Lesson whose Markdown is split into
 * Markdown + Circuit blocks. `contentRefId` is preset to the legacy lesson
 * UUID so learner state keeps pointing at the same lesson.
 *
 * Idempotent: documents are matched by slug / contentRefId and re-runs only
 * create what is missing. Requires the backend (BACKEND_API_URL +
 * CMS_WEBHOOK_SECRET) to bind refs; exits non-zero if any step fails.
 */
import config from '@payload-config'
import { readFile } from 'fs/promises'
import { getPayload, type Payload } from 'payload'

import { slugify } from '../src/fields/slug'
import { registerLessonRef } from '../src/hooks/backend'
import { SKIP_CONTENT_REF_SYNC } from '../src/hooks/registerContentRef'
import { legacyMarkdownToBlocks, verifyConversion } from '../src/lib/legacyImport'

type LegacyLesson = { id: string; title: string; content: string | null; order_index: number }
type LegacyModule = { id: string; title: string; description: string | null; order_index: number; lessons: LegacyLesson[] }
type LegacyCourse = { id: string; title: string; description: string | null; difficulty: string; modules: LegacyModule[] }
type LegacyExport = { version: number; courses: LegacyCourse[] }

const byOrder = <T extends { order_index: number }>(a: T, b: T) => a.order_index - b.order_index
const published = { _status: 'published' as const }
// Binding is done explicitly below so failures are reported, not just logged.
const context = { [SKIP_CONTENT_REF_SYNC]: true }

async function findOne(payload: Payload, collection: 'curriculums' | 'levels' | 'modules' | 'lessons', where: object) {
  const { docs } = await payload.find({ collection, where: where as never, limit: 1, depth: 0, draft: true })
  return docs[0] as { id: number | string; contentRefId?: string | null } | undefined
}

async function main() {
  const file = process.argv.slice(2).find((a) => a.endsWith('.json'))
  if (!file) throw new Error('usage: pnpm import:legacy <legacy-curriculum.json>')
  const data = JSON.parse(await readFile(file, 'utf8')) as LegacyExport
  if (data.version !== 1) throw new Error(`Unsupported export version ${data.version}`)

  const payload = await getPayload({ config })
  const problems: string[] = []
  let created = 0
  let lessonsSeen = 0

  // Documents are matched by slug, so two legacy sources whose titles slugify
  // identically would silently merge. Refuse the second one instead.
  const claimedSlugs = new Map<string, string>()
  const claim = (key: string, legacyId: string, label: string): boolean => {
    const owner = claimedSlugs.get(key)
    if (owner && owner !== legacyId) {
      problems.push(`${label} (${legacyId}): slug collides with ${owner}; skipped — rename one of them`)
      return false
    }
    claimedSlugs.set(key, legacyId)
    return true
  }

  for (const course of data.courses) {
    const curriculumSlug = slugify(course.title)
    if (!claim(`curriculum:${curriculumSlug}`, course.id, `course "${course.title}"`)) continue
    let curriculum = await findOne(payload, 'curriculums', { slug: { equals: curriculumSlug } })
    if (!curriculum) {
      curriculum = await payload.create({
        collection: 'curriculums',
        data: { title: course.title, slug: curriculumSlug, description: course.description, ...published },
        context,
      })
      created++
    }

    const modules = [...course.modules].sort(byOrder)
    for (const [index, legacyModule] of modules.entries()) {
      const slug = slugify(legacyModule.title)
      if (!claim(`level:${curriculumSlug}:${slug}`, legacyModule.id, `module "${legacyModule.title}"`)) continue
      let level = await findOne(payload, 'levels', {
        and: [{ curriculum: { equals: curriculum.id } }, { slug: { equals: slug } }],
      })
      if (!level) {
        level = await payload.create({
          collection: 'levels',
          data: {
            curriculum: curriculum.id as number,
            levelNumber: index,
            title: legacyModule.title,
            slug,
            description: legacyModule.description,
            order: legacyModule.order_index,
            ...published,
          },
          context,
        })
        created++
      }

      let cmsModule = await findOne(payload, 'modules', {
        and: [{ level: { equals: level.id } }, { slug: { equals: slug } }],
      })
      if (!cmsModule) {
        cmsModule = await payload.create({
          collection: 'modules',
          data: { level: level.id as number, title: legacyModule.title, slug, order: 0, ...published },
          context,
        })
        created++
      }

      for (const lesson of [...legacyModule.lessons].sort(byOrder)) {
        lessonsSeen++
        const label = `lesson "${lesson.title}" (${lesson.id})`
        const { blocks, warnings } = legacyMarkdownToBlocks(lesson.content)
        warnings.forEach((w) => payload.logger.warn(`${label}: ${w}`))
        verifyConversion(lesson.content, blocks).forEach((p) => problems.push(`${label}: ${p}`))

        let doc = await findOne(payload, 'lessons', { contentRefId: { equals: lesson.id } })
        if (!doc) {
          doc = await payload.create({
            collection: 'lessons',
            data: {
              module: cmsModule.id as number,
              title: lesson.title,
              slug: slugify(lesson.title),
              order: lesson.order_index,
              blocks: blocks as never,
              contentRefId: lesson.id,
              ...published,
            },
            context,
          })
          created++
        }

        try {
          const ref = await registerLessonRef(String(doc.id), lesson.id)
          if (ref.id !== lesson.id) problems.push(`${label}: bound to unexpected ref ${ref.id}`)
        } catch (err) {
          problems.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
  }

  payload.logger.info(`Legacy import: ${lessonsSeen} lesson(s) processed, ${created} document(s) created.`)
  if (problems.length) {
    problems.forEach((p) => payload.logger.error(p))
    process.exit(1)
  }
  payload.logger.info('Legacy import validated: every lesson converted and bound to its content ref.')
  process.exit(0)
}

// `payload run` exits once this module's evaluation settles, so await here.
await main()
