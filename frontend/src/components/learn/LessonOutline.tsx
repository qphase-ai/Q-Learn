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
      <aside
        style={{
          width: "220px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          padding: "0.75rem 0",
          color: "var(--text-muted)",
          fontSize: "0.8125rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        No course loaded
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: "220px",
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        padding: "0.75rem 0",
        fontSize: "0.8125rem",
      }}
    >
      {/* Course header — if multiple courses exist, show selector */}
      {courses.length > 1 ? (
        <div style={{ padding: "0 0.75rem 0.5rem" }}>
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => loadCourse(c.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: c.id === activeCourse.id ? "var(--quantum)" : "var(--text-secondary)",
                padding: "0.25rem 0",
                fontWeight: c.id === activeCourse.id ? 600 : 400,
              }}
            >
              {c.title}
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "0 0.75rem 0.5rem",
            color: "var(--text-secondary)",
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {activeCourse.title}
        </div>
      )}

      {/* Modules and lessons */}
      {activeCourse.modules.map((mod: ModuleWithLessons) => (
        <div key={mod.id} style={{ marginBottom: "0.5rem" }}>
          <div
            style={{
              padding: "0.25rem 0.75rem",
              color: "var(--text-muted)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.375rem 0.75rem",
                  color: isActive ? "var(--quantum)" : "var(--text-primary)",
                  borderLeft: isActive ? "2px solid var(--quantum)" : "2px solid transparent",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  lineHeight: 1.4,
                }}
              >
                <span style={{ flex: 1 }}>{lesson.title}</span>
                {isCompleted && (
                  <span
                    aria-label="completed"
                    style={{
                      color: "var(--success)",
                      fontSize: "0.75rem",
                      lineHeight: 1,
                    }}
                  >
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
