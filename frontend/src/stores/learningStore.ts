import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LearningStore {
  currentLessonId: string | null;
  lessonProgress: Record<string, number>;
  masteryScores: Record<string, number>;
  xp: number;
  streak: number;
  setCurrentLesson: (id: string | null) => void;
  updateProgress: (lessonId: string, pct: number) => void;
  updateMastery: (conceptId: string, score: number) => void;
  addXp: (amount: number) => void;
}

export const useLearningStore = create<LearningStore>()(
  persist(
    (set) => ({
      currentLessonId: null,
      lessonProgress: {},
      masteryScores: {},
      xp: 0,
      streak: 0,
      setCurrentLesson: (id) => set({ currentLessonId: id }),
      updateProgress: (lessonId, pct) =>
        set((s) => ({ lessonProgress: { ...s.lessonProgress, [lessonId]: pct } })),
      updateMastery: (conceptId, score) =>
        set((s) => ({ masteryScores: { ...s.masteryScores, [conceptId]: score } })),
      addXp: (amount) => set((s) => ({ xp: s.xp + amount })),
    }),
    { name: "learning", partialize: (s) => ({ lessonProgress: s.lessonProgress, xp: s.xp, streak: s.streak }) }
  )
);
