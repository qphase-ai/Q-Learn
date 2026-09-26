"use client";

import { useEffect, useState } from "react";
import { useLearningStore } from "@/stores/learningStore";
import { isLessonCompleted, sortedLessons, sortedModules } from "@/lib/curriculum";

/**
 * Course/lesson auto-load bootstrap shared by every route that mounts
 * `LabShell` (dashboard, learn, circuit, code). Loads the course list, picks
 * the first course once it arrives, then auto-selects the first incomplete
 * lesson in that course (or the first lesson overall if all are complete).
 */
export function useCourseBootstrap() {
  const courses = useLearningStore((s) => s.courses);
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadCourses = useLearningStore((s) => s.loadCourses);
  const loadCourse = useLearningStore((s) => s.loadCourse);
  const loadLesson = useLearningStore((s) => s.loadLesson);

  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  function fetchCourses() {
    setCoursesLoading(true);
    setCoursesError(null);
    loadCourses()
      .catch((err) => {
        setCoursesError(err instanceof Error ? err.message : "Failed to load courses");
      })
      .finally(() => setCoursesLoading(false));
  }

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!coursesLoading && !activeCourse && courses.length > 0) {
      void loadCourse(courses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursesLoading, activeCourse, courses]);

  useEffect(() => {
    if (!activeCourse || currentLessonId) return;
    const modules = sortedModules(activeCourse);
    let fallback: string | null = null;
    for (const mod of modules) {
      for (const lesson of sortedLessons(mod)) {
        if (!fallback) fallback = lesson.id;
        if (!isLessonCompleted(lessonProgress, lesson.id)) {
          void loadLesson(lesson.id);
          return;
        }
      }
    }
    if (fallback) void loadLesson(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourse, currentLessonId]);

  return { coursesLoading, coursesError, onRetry: fetchCourses };
}
