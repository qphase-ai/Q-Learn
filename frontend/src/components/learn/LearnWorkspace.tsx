"use client";

import { useEffect } from "react";
import { useLearningStore } from "@/stores/learningStore";
import { useShellStore } from "@/stores/shellStore";
import LessonOutline from "@/components/learn/LessonOutline";
import LessonContent from "@/components/learn/LessonContent";

export default function LearnWorkspace() {
  const loadCourses = useLearningStore((s) => s.loadCourses);
  const loadCourse = useLearningStore((s) => s.loadCourse);
  const setFocusMode = useShellStore((s) => s.setFocusMode);

  useEffect(() => {
    setFocusMode(false);

    loadCourses().then(() => {
      // After courses load, auto-select the first course if none is active
      const { courses, activeCourse } = useLearningStore.getState();
      if (courses.length > 0 && !activeCourse) {
        loadCourse(courses[0].id);
      }
    });
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <LessonOutline />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
        }}
      >
        <LessonContent />
      </div>
    </div>
  );
}
