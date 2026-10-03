import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CourseSummary, CourseDetail, LessonDetail, LessonSearchResult } from "@/types";
import { apiFetch } from "@/lib/api";
import { cmsContent, contentSource, isTrackableLessonId } from "@/lib/content-source";
import { getAccessToken } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

interface LearningStore {
  // Existing state
  currentLessonId: string | null;
  lessonProgress: Record<string, number>;
  masteryScores: Record<string, number>;
  xp: number;
  streak: number;

  // New state
  courses: CourseSummary[];
  activeCourse: CourseDetail | null;
  activeLesson: LessonDetail | null;

  // Existing actions
  setCurrentLesson: (id: string | null) => void;
  updateProgress: (lessonId: string, pct: number) => void;
  updateMastery: (conceptId: string, score: number) => void;
  addXp: (amount: number) => void;

  // New actions
  loadCourses: () => Promise<void>;
  loadCourse: (id: string) => Promise<void>;
  loadLesson: (id: string) => Promise<void>;
  markProgress: (lessonId: string, pct: number) => Promise<void>;
  searchLessons: (query: string) => Promise<LessonSearchResult[]>;
}

export const useLearningStore = create<LearningStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ────────────────────────────────────────────────────
      currentLessonId: null,
      lessonProgress: {},
      masteryScores: {},
      xp: 0,
      streak: 0,
      courses: [],
      activeCourse: null,
      activeLesson: null,

      // ── Existing actions ─────────────────────────────────────────────────
      setCurrentLesson: (id) => set({ currentLessonId: id }),
      updateProgress: (lessonId, pct) =>
        set((s) => ({ lessonProgress: { ...s.lessonProgress, [lessonId]: pct } })),
      updateMastery: (conceptId, score) =>
        set((s) => ({ masteryScores: { ...s.masteryScores, [conceptId]: score } })),
      addXp: (amount) => set((s) => ({ xp: s.xp + amount })),

      // ── New async actions ────────────────────────────────────────────────
      loadCourses: async () => {
        if (contentSource() === "cms") {
          set({ courses: await cmsContent.listCourses() });
          return;
        }
        const token = (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined;
        const courses = await apiFetch<CourseSummary[]>("/api/v1/courses", { token });
        set({ courses });
      },

      loadCourse: async (id) => {
        if (contentSource() === "cms") {
          set({ activeCourse: await cmsContent.getCourse(id) });
          return;
        }
        const token = (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined;
        const activeCourse = await apiFetch<CourseDetail>(`/api/v1/courses/${id}`, { token });
        set({ activeCourse });
      },

      loadLesson: async (id) => {
        let activeLesson: LessonDetail;
        if (contentSource() === "cms") {
          activeLesson = await cmsContent.getLesson(id);
        } else {
          const token = (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined;
          activeLesson = await apiFetch<LessonDetail>(`/api/v1/lessons/${id}`, { token });
        }
        set({ activeLesson, currentLessonId: id });
      },

      markProgress: async (lessonId, pct) => {
        // Progress is keyed by content_refs id; a CMS lesson without one
        // has nowhere to record it on the backend.
        if (!isTrackableLessonId(lessonId)) return;
        // Optimistic update
        set((s) => ({ lessonProgress: { ...s.lessonProgress, [lessonId]: pct } }));
        const token = (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined;
        await apiFetch(`/api/v1/lessons/${lessonId}/progress`, {
          method: "PUT",
          body: JSON.stringify({
            status: pct >= 100 ? "completed" : "in_progress",
            completion_pct: pct,
          }),
          token,
        });
      },

      searchLessons: async (query) => {
        const q = query.trim();
        if (contentSource() === "cms") {
          // Payload has no search route yet; match titles in the loaded course.
          const course = get().activeCourse;
          if (!course) return [];
          const needle = q.toLowerCase();
          return course.modules.flatMap((mod) =>
            mod.lessons
              .filter((lesson) => lesson.title.toLowerCase().includes(needle))
              .map((lesson) => ({
                lesson_id: lesson.id,
                lesson_title: lesson.title,
                lesson_type: lesson.lesson_type,
                is_pro: lesson.is_pro,
                module_id: mod.id,
                module_title: mod.title,
                course_id: course.id,
                course_title: course.title,
                snippet: null,
              }))
          );
        }
        const token = (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined;
        const params = new URLSearchParams({ q, limit: "10" });
        return apiFetch<LessonSearchResult[]>(`/api/v1/search/lessons?${params}`, { token });
      },
    }),
    {
      name: "learning",
      partialize: (s) => ({ lessonProgress: s.lessonProgress, xp: s.xp, streak: s.streak }),
    }
  )
);
