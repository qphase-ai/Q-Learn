"use client";

import { useLearningStore } from "@/stores/learningStore";
import type { LessonSummary, ModuleWithLessons } from "@/types";

export default function LessonOutline() {
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const courses = useLearningStore((s) => s.courses);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadCourse = useLearningStore((s) => s.loadCourse);
  const loadLesson = useLearningStore((s) => s.loadLesson);

  if (!activeCourse) {
    return (
      <aside className="flex w-[220px] flex-shrink-0 items-center justify-center overflow-y-auto border-r border-border px-0 py-3 text-[0.8125rem] text-muted-foreground">
        No course loaded
      </aside>
    );
  }

  return (
    <aside className="w-[220px] flex-shrink-0 overflow-y-auto border-r border-border py-3 text-[0.8125rem]">
      {/* Course header — if multiple courses exist, show selector */}
      {courses.length > 1 ? (
        <div className="px-3 pb-2">
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => loadCourse(c.id)}
              className={`block w-full cursor-pointer border-none bg-transparent py-1 text-left ${
                c.id === activeCourse.id
                  ? "font-semibold text-cyber-cyan"
                  : "font-normal text-muted-foreground"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {activeCourse.title}
        </div>
      )}

      {/* Modules and lessons */}
      {activeCourse.modules.map((mod: ModuleWithLessons) => (
        <div key={mod.id} className="mb-2">
          <div className="px-3 py-1 text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            {mod.title}
          </div>

          {mod.lessons.map((lesson: LessonSummary) => {
            const isActive = lesson.id === currentLessonId;
            const isCompleted = (lessonProgress[lesson.id] ?? 0) >= 100;

            return (
              <button
                key={lesson.id}
                data-active={isActive ? "true" : "false"}
                onClick={() => loadLesson(lesson.id)}
                className={`flex w-full cursor-pointer items-center gap-2 border-l-2 bg-transparent px-3 py-1.5 text-left text-[0.8125rem] leading-snug outline-none ${
                  isActive
                    ? "border-cyber-cyan text-cyber-cyan"
                    : "border-transparent text-foreground"
                }`}
              >
                <span className="flex-1">{lesson.title}</span>
                {isCompleted && (
                  <span aria-label="completed" className="text-xs leading-none text-success">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
