import type { CourseDetail, ModuleWithLessons, LessonSummary } from "@/types";

/**
 * Derived curriculum-progression helpers shared by `CurriculumSidebar`,
 * `CentralWorkspace`, and `DashboardHeader`. There is no module-level
 * "level number" or lock/entitlement field in the API — everything here is
 * a client-side derivation from `CourseDetail.modules` (ordered by
 * `order_index`) plus the locally-persisted `lessonProgress` map.
 */

export function sortedModules(course: CourseDetail): ModuleWithLessons[] {
  return [...course.modules].sort((a, b) => a.order_index - b.order_index);
}

export function sortedLessons(module: ModuleWithLessons): LessonSummary[] {
  return [...module.lessons].sort((a, b) => a.order_index - b.order_index);
}

export function isLessonCompleted(
  lessonProgress: Record<string, number>,
  lessonId: string
): boolean {
  return (lessonProgress[lessonId] ?? 0) >= 100;
}

export function isModuleCompleted(
  module: ModuleWithLessons,
  lessonProgress: Record<string, number>
): boolean {
  return (
    module.lessons.length > 0 &&
    module.lessons.every((l) => isLessonCompleted(lessonProgress, l.id))
  );
}

export function moduleCompletion(
  module: ModuleWithLessons,
  lessonProgress: Record<string, number>
): { done: number; total: number } {
  const done = module.lessons.filter((l) => isLessonCompleted(lessonProgress, l.id)).length;
  return { done, total: module.lessons.length };
}

/**
 * Sequential unlock: a module is locked if the previous module (by
 * `order_index`) isn't fully completed. No entitlement/plan field is
 * surfaced client-side today, so per-lesson `is_pro` gating is out of scope
 * for v1 — see design plan §3.
 */
export function isModuleLocked(
  modules: ModuleWithLessons[],
  index: number,
  lessonProgress: Record<string, number>
): boolean {
  if (index === 0) return false;
  const previous = modules[index - 1];
  return !isModuleCompleted(previous, lessonProgress);
}

export function findModuleIndexForLesson(
  modules: ModuleWithLessons[],
  lessonId: string | null
): number {
  if (!lessonId) return -1;
  return modules.findIndex((m) => m.lessons.some((l) => l.id === lessonId));
}

export function levelLabel(moduleIndex: number): string {
  return `Level ${moduleIndex + 1}`;
}

export function lessonLabel(moduleIndex: number, lessonIndex: number, title: string): string {
  return `${moduleIndex + 1}.${lessonIndex + 1} ${title}`;
}

/** Strip light markdown syntax and return an approximate one-sentence summary. */
export function firstSentence(markdown: string | null | undefined, maxLen = 160): string {
  if (!markdown) return "";
  const plain = markdown
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  const match = plain.match(/^.*?[.!?](?:\s|$)/);
  const sentence = (match ? match[0] : plain).trim();
  return sentence.length > maxLen ? `${sentence.slice(0, maxLen).trim()}…` : sentence;
}
