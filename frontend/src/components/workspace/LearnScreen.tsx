"use client";

import { useEffect } from "react";
import { useLearningStore } from "@/stores/learningStore";
import CurriculumSidebar from "@/components/learn/CurriculumSidebar";
import LessonWorkspace from "@/components/workspace/LessonWorkspace";

/**
 * The unified Learn experience: Quantum Curriculum sidebar + tabbed lesson
 * workspace. All data comes from the real learning API (courses, lesson,
 * progress) via `learningStore`.
 */
export default function LearnScreen() {
  useEffect(() => {
    const { loadCourses, loadCourse, loadLesson, loadProgress } = useLearningStore.getState();

    void loadProgress().catch(() => {});
    void loadCourses()
      .then(async () => {
        const { courses, activeCourse } = useLearningStore.getState();
        if (courses.length === 0) return;
        if (!activeCourse) await loadCourse(courses[0].id);

        const course = useLearningStore.getState().activeCourse;
        const { currentLessonId } = useLearningStore.getState();
        if (course && !currentLessonId) {
          const firstLesson = course.modules[0]?.lessons[0];
          if (firstLesson) await loadLesson(firstLesson.id);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <CurriculumSidebar />
      <LessonWorkspace />
    </div>
  );
}
