import type { CourseDetail, ModuleWithLessons } from "@/types";

/**
 * Average completion percentage (0–100) across a module's lessons, using the
 * client's `lessonProgress` map (hydrated from `GET /api/v1/progress`). Lessons
 * without a recorded row count as 0 so the bar reflects real, not optimistic,
 * progress.
 */
export function moduleProgressPct(
  module: ModuleWithLessons,
  lessonProgress: Record<string, number>
): number {
  if (module.lessons.length === 0) return 0;
  const total = module.lessons.reduce(
    (sum, l) => sum + (lessonProgress[l.id] ?? 0),
    0
  );
  return Math.round(total / module.lessons.length);
}

/** The module (1-indexed "Level") that contains a given lesson id, if any. */
export function findModuleOfLesson(
  course: CourseDetail | null,
  lessonId: string | null
): { module: ModuleWithLessons; level: number } | null {
  if (!course || !lessonId) return null;
  for (let i = 0; i < course.modules.length; i++) {
    if (course.modules[i].lessons.some((l) => l.id === lessonId)) {
      return { module: course.modules[i], level: i + 1 };
    }
  }
  return null;
}

/** Overall course completion percentage (0–100) across every lesson. */
export function courseProgressPct(
  course: CourseDetail | null,
  lessonProgress: Record<string, number>
): number {
  if (!course) return 0;
  const lessons = course.modules.flatMap((m) => m.lessons);
  if (lessons.length === 0) return 0;
  const total = lessons.reduce((sum, l) => sum + (lessonProgress[l.id] ?? 0), 0);
  return Math.round(total / lessons.length);
}
