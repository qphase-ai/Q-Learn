import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CourseSummary, CourseDetail, LessonDetail, ProgressItem } from "@/types";
import { apiFetch } from "@/lib/api";
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
  loadProgress: () => Promise<void>;
  markProgress: (lessonId: string, pct: number) => Promise<void>;
}

export const useLearningStore = create<LearningStore>()(
  persist(
    (set) => ({
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
        const token = useAuthStore.getState().jwt ?? undefined;
        const courses = await apiFetch<CourseSummary[]>("/api/v1/courses", { token });
        set({ courses });
      },

      loadCourse: async (id) => {
        const token = useAuthStore.getState().jwt ?? undefined;
        const activeCourse = await apiFetch<CourseDetail>(`/api/v1/courses/${id}`, { token });
        set({ activeCourse });
      },

      loadLesson: async (id) => {
        const token = useAuthStore.getState().jwt ?? undefined;
        const activeLesson = await apiFetch<LessonDetail>(`/api/v1/lessons/${id}`, { token });
        set({ activeLesson, currentLessonId: id });
      },

      loadProgress: async () => {
        const token = useAuthStore.getState().jwt ?? undefined;
        const items = await apiFetch<ProgressItem[]>("/api/v1/progress", { token });
        set((s) => {
          const merged = { ...s.lessonProgress };
          for (const item of items) {
            merged[item.lesson_id] = item.completion_pct;
          }
          return { lessonProgress: merged };
        });
      },

      markProgress: async (lessonId, pct) => {
        // Optimistic update
        set((s) => ({ lessonProgress: { ...s.lessonProgress, [lessonId]: pct } }));
        const token = useAuthStore.getState().jwt ?? undefined;
        await apiFetch(`/api/v1/lessons/${lessonId}/progress`, {
          method: "PUT",
          body: JSON.stringify({
            status: pct >= 100 ? "completed" : "in_progress",
            completion_pct: pct,
          }),
          token,
        });
      },
    }),
    {
      name: "learning",
      partialize: (s) => ({ lessonProgress: s.lessonProgress, xp: s.xp, streak: s.streak }),
    }
  )
);
