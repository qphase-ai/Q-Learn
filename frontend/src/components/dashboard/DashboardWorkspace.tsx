"use client";

import { useEffect, useState } from "react";
import { useLearningStore } from "@/stores/learningStore";
import { useTutorStore } from "@/stores/tutorStore";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardActivityBar from "@/components/dashboard/DashboardActivityBar";
import CurriculumSidebar from "@/components/dashboard/CurriculumSidebar";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import DashboardTutorPanel, {
  type AskableTab,
  type TutorTab,
} from "@/components/dashboard/DashboardTutorPanel";
import { isLessonCompleted, sortedLessons, sortedModules } from "@/lib/curriculum";

const CANNED_PROMPTS: Record<AskableTab, string> = {
  explain: "Explain my circuit",
  hints: "Give me a hint for this lesson",
  next: "What should I try next?",
};

export default function DashboardWorkspace() {
  const courses = useLearningStore((s) => s.courses);
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadCourses = useLearningStore((s) => s.loadCourses);
  const loadCourse = useLearningStore((s) => s.loadCourse);
  const loadLesson = useLearningStore((s) => s.loadLesson);

  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [activeTutorTab, setActiveTutorTab] = useState<TutorTab>("chat");
  const [askedTutorTabs, setAskedTutorTabs] = useState<Set<AskableTab>>(new Set());
  const [tutorAskError, setTutorAskError] = useState<string | null>(null);

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

  function askTutor(tab: AskableTab) {
    setActiveTutorTab(tab);
    if (askedTutorTabs.has(tab)) return;
    setTutorAskError(null);
    useTutorStore
      .getState()
      .sendMessage(CANNED_PROMPTS[tab])
      .then(() => {
        setAskedTutorTabs((prev) => new Set(prev).add(tab));
      })
      .catch((err) => {
        setTutorAskError(err instanceof Error ? err.message : "Couldn't reach the tutor — try again.");
      });
  }

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardActivityBar onOpenTutor={() => setActiveTutorTab("chat")} />
        <CurriculumSidebar
          loading={coursesLoading}
          error={coursesError}
          onRetry={fetchCourses}
        />
        <CentralWorkspace onExplainCircuit={() => askTutor("explain")} />
        <DashboardTutorPanel
          activeTab={activeTutorTab}
          onTabChange={setActiveTutorTab}
          askedTabs={askedTutorTabs}
          onAsk={askTutor}
          askError={tutorAskError}
        />
      </div>
    </div>
  );
}
