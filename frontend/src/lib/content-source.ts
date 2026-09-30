import type { CourseDetail, CourseSummary, LessonDetail } from "@/types";

/**
 * Where curriculum content is read from. `legacy` (default) is FastAPI's
 * /api/v1/courses; `cms` is Payload, via this app's /api/cms/* route
 * handlers (see lib/cms.ts). Migration step 5 in
 * docs/Curriculum/cirrculum-store-architecture.md — flip with
 * NEXT_PUBLIC_CONTENT_SOURCE=cms. Learner state always stays on FastAPI.
 */
export type ContentSource = "legacy" | "cms";

export function contentSource(): ContentSource {
  return process.env.NEXT_PUBLIC_CONTENT_SOURCE === "cms" ? "cms" : "legacy";
}

/**
 * Lessons published without a backend content ref (registration failed) are
 * keyed `payload:<id>`. They render, but have nowhere to record progress.
 */
export function isTrackableLessonId(id: string): boolean {
  return !id.startsWith("payload:");
}

async function cmsRoute<T>(path: string): Promise<T> {
  const res = await fetch(`/api/cms${path}`);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? "Failed to load curriculum content");
  }
  return json.data as T;
}

export const cmsContent = {
  listCourses: () => cmsRoute<CourseSummary[]>("/courses"),
  getCourse: (id: string) => cmsRoute<CourseDetail>(`/courses/${encodeURIComponent(id)}`),
  getLesson: (id: string) => cmsRoute<LessonDetail>(`/lessons/${encodeURIComponent(id)}`),
};
