import type {
  CmsMedia,
  CourseDetail,
  CourseSummary,
  LessonBlock,
  LessonDetail,
  LessonSummary,
  ModuleWithLessons,
} from "@/types";

/**
 * Server-side reads of published curriculum from the Payload CMS (cms/).
 * Only the /api/cms/* route handlers import this: requests are anonymous, so
 * Payload's access control returns published documents only, and responses
 * sit in Next's data cache until the CMS calls /api/revalidate.
 *
 * Payload's Curriculum → Level → Module → Lesson tree is mapped onto the
 * shape the app already renders (CourseDetail): a curriculum is a course,
 * each level is a sidebar "module" (the sidebar already labels them
 * "Level N"), and a level's lessons are listed in module order.
 * Lesson ids are the backend content_refs ids, so progress recorded against
 * legacy lessons carries over unchanged.
 */

export const CMS_TAGS = {
  curriculum: "cms:curriculum",
  lesson: (lessonId: string) => `cms:lesson:${lessonId}`,
} as const;

// Upper bound between CMS revalidation calls, in case one is missed.
const REVALIDATE_SECONDS = 300;

// ── Payload document shapes (the subset we read) ─────────────────────────

type Id = number | string;

export interface PayloadCurriculum {
  id: Id;
  title: string;
  description?: string | null;
}

export interface PayloadLevel {
  id: Id;
  title: string;
  levelNumber: number;
  order?: number | null;
}

export interface PayloadModule {
  id: Id;
  level: Id | { id: Id };
  order?: number | null;
}

export interface PayloadLesson {
  id: Id;
  title: string;
  module: Id | { id: Id };
  order?: number | null;
  difficulty?: string | null;
  contentRefId?: string | null;
  blocks?: LessonBlock[] | null;
}

interface PayloadList<T> {
  docs: T[];
}

// ── Pure mapping ─────────────────────────────────────────────────────────

const relId = (value: Id | { id: Id }) => String(typeof value === "object" ? value.id : value);

export function lessonId(lesson: Pick<PayloadLesson, "id" | "contentRefId">): string {
  return lesson.contentRefId || `payload:${lesson.id}`;
}

function lessonType(blocks: LessonBlock[] | null | undefined): LessonSummary["lesson_type"] {
  if (!blocks?.length) return "text";
  if (blocks.some((b) => b.blockType === "quiz")) return "quiz";
  if (blocks.some((b) => b.blockType === "circuit" || b.blockType === "simulation")) return "circuit";
  return "text";
}

export function toCourseSummary(curriculum: PayloadCurriculum): CourseSummary {
  return {
    id: String(curriculum.id),
    title: curriculum.title,
    description: curriculum.description ?? null,
    difficulty: "beginner",
  };
}

export function buildCourseDetail(
  curriculum: PayloadCurriculum,
  levels: PayloadLevel[],
  modules: PayloadModule[],
  lessons: PayloadLesson[]
): CourseDetail {
  const byOrder = (a: { order?: number | null }, b: { order?: number | null }) =>
    (a.order ?? 0) - (b.order ?? 0);

  const sortedLevels = [...levels].sort(
    (a, b) => a.levelNumber - b.levelNumber || byOrder(a, b)
  );

  const detailModules: ModuleWithLessons[] = sortedLevels.map((level, levelIndex) => {
    const levelLessons = [...modules]
      .filter((m) => relId(m.level) === String(level.id))
      .sort(byOrder)
      .flatMap((m) => lessons.filter((l) => relId(l.module) === String(m.id)).sort(byOrder));

    return {
      id: String(level.id),
      title: level.title,
      order_index: levelIndex,
      lessons: levelLessons.map((lesson, i) => ({
        id: lessonId(lesson),
        title: lesson.title,
        lesson_type: lessonType(lesson.blocks),
        is_pro: false,
        order_index: i,
      })),
    };
  });

  return { ...toCourseSummary(curriculum), modules: detailModules };
}

/** Resolve relative Payload media URLs against the CMS origin. */
export function absolutizeMedia(blocks: LessonBlock[], cmsUrl: string): LessonBlock[] {
  return blocks.map((block) => {
    if (block.blockType !== "image" || !block.image || typeof block.image !== "object") return block;
    const url = block.image.url;
    if (!url || /^https?:\/\//i.test(url)) return block;
    const image: CmsMedia = { ...block.image, url: new URL(url, cmsUrl).toString() };
    return { ...block, image };
  });
}

/**
 * Plain-Markdown rendition of a lesson's blocks. LessonDetail.content feeds
 * the lesson summary and the AI tutor's context, which predate blocks.
 */
export function blocksToMarkdown(blocks: LessonBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.blockType) {
      case "heading":
        parts.push(`${"#".repeat(Number(block.level) || 2)} ${block.text}`);
        break;
      case "text":
      case "markdown":
        parts.push(block.body);
        break;
      case "math":
        parts.push(block.displayMode === false ? `$${block.latex}$` : `$$\n${block.latex}\n$$`);
        break;
      case "callout":
        parts.push([block.title && `**${block.title}**`, block.body].filter(Boolean).join("\n\n"));
        break;
      case "code":
        parts.push(`\`\`\`${block.language}\n${block.code}\n\`\`\``);
        break;
      case "quiz":
        parts.push(`Question: ${block.question}`);
        break;
      case "circuit":
      case "simulation":
        if (block.title) parts.push(`Circuit: ${block.title}`);
        if (block.description) parts.push(block.description);
        break;
    }
  }
  return parts.filter((p) => p && p.trim()).join("\n\n");
}

export function buildLessonDetail(lesson: PayloadLesson, levelId: string, cmsUrl: string): LessonDetail {
  const blocks = absolutizeMedia(lesson.blocks ?? [], cmsUrl);
  return {
    id: lessonId(lesson),
    module_id: levelId,
    title: lesson.title,
    content: blocksToMarkdown(blocks),
    lesson_type: lessonType(blocks),
    is_pro: false,
    concepts: [],
    blocks,
  };
}

// ── Fetching (server only) ───────────────────────────────────────────────

export class CmsNotFoundError extends Error {}

// Ids arrive from the browser; only well-formed ones reach the CMS.
const DOC_ID = /^[A-Za-z0-9-]{1,64}$/;
const LESSON_ID = /^(payload:[A-Za-z0-9-]{1,64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function cmsUrl(): string {
  const url = process.env.CMS_URL;
  if (!url) throw new Error("CMS_URL is not configured");
  return url.replace(/\/$/, "");
}

async function payloadGet<T>(path: string, params: Record<string, string>, tags: string[]): Promise<T> {
  const query = new URLSearchParams({ depth: "0", ...params });
  const res = await fetch(`${cmsUrl()}/api/${path}?${query}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS, tags },
  });
  if (res.status === 404 || res.status === 403) throw new CmsNotFoundError(`${path} not found`);
  if (!res.ok) throw new Error(`CMS request failed (${res.status}) for ${path}`);
  return (await res.json()) as T;
}

const inList = (ids: Id[]) => ids.map(String).join(",");

export async function fetchCourses(): Promise<CourseSummary[]> {
  const { docs } = await payloadGet<PayloadList<PayloadCurriculum>>(
    "curriculums",
    { limit: "100", sort: "createdAt" },
    [CMS_TAGS.curriculum]
  );
  return docs.map(toCourseSummary);
}

export async function fetchCourseDetail(curriculumId: string): Promise<CourseDetail> {
  if (!DOC_ID.test(curriculumId)) throw new CmsNotFoundError(`Course ${curriculumId} not found`);
  const tags = [CMS_TAGS.curriculum];
  const curriculum = await payloadGet<PayloadCurriculum>(
    `curriculums/${encodeURIComponent(curriculumId)}`,
    {},
    tags
  );
  const { docs: levels } = await payloadGet<PayloadList<PayloadLevel>>(
    "levels",
    { "where[curriculum][equals]": String(curriculum.id), limit: "100" },
    tags
  );
  const { docs: modules } = levels.length
    ? await payloadGet<PayloadList<PayloadModule>>(
        "modules",
        { "where[level][in]": inList(levels.map((l) => l.id)), limit: "1000" },
        tags
      )
    : { docs: [] };
  const { docs: lessons } = modules.length
    ? await payloadGet<PayloadList<PayloadLesson>>(
        "lessons",
        {
          "where[module][in]": inList(modules.map((m) => m.id)),
          limit: "1000",
          "select[title]": "true",
          "select[module]": "true",
          "select[order]": "true",
          "select[contentRefId]": "true",
          // Block types only (for lesson_type), not block content.
          "select[blocks][blockType]": "true",
        },
        tags
      )
    : { docs: [] };
  return buildCourseDetail(curriculum, levels, modules, lessons);
}

export async function fetchLessonDetail(id: string): Promise<LessonDetail> {
  if (!LESSON_ID.test(id)) throw new CmsNotFoundError(`Lesson ${id} not found`);
  const tags = [CMS_TAGS.curriculum, CMS_TAGS.lesson(id)];
  // depth=1 populates image uploads and the parent module (for its level).
  let lesson: PayloadLesson | undefined;
  if (id.startsWith("payload:")) {
    lesson = await payloadGet<PayloadLesson>(
      `lessons/${encodeURIComponent(id.slice("payload:".length))}`,
      { depth: "1" },
      tags
    );
  } else {
    const { docs } = await payloadGet<PayloadList<PayloadLesson>>(
      "lessons",
      { "where[contentRefId][equals]": id, limit: "1", depth: "1" },
      tags
    );
    lesson = docs[0];
  }
  if (!lesson) throw new CmsNotFoundError(`Lesson ${id} not found`);

  const parent =
    typeof lesson.module === "object"
      ? (lesson.module as PayloadModule)
      : await payloadGet<PayloadModule>(`modules/${encodeURIComponent(String(lesson.module))}`, {}, tags);
  return buildLessonDetail(lesson, relId(parent.level), cmsUrl());
}
