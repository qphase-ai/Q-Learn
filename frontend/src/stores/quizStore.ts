import { create } from "zustand";
import type { LessonDetail } from "@/types";
import type { QuizQuestion } from "@/types/quiz";
import { generateQuizFromLesson } from "@/lib/quiz-generator";

interface QuizStore {
  quiz: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  hintsUsed: Record<string, boolean>;
  score: number;
  setQuiz: (quiz: QuizQuestion[]) => void;
  loadQuizForLesson: (lesson: LessonDetail) => void;
  setAnswer: (questionId: string, answer: string) => void;
  useHint: (questionId: string) => void;
  nextQuestion: () => void;
  setScore: (score: number) => void;
  reset: () => void;
}

export const useQuizStore = create<QuizStore>((set) => ({
  quiz: [],
  currentIndex: 0,
  answers: {},
  hintsUsed: {},
  score: 0,
  setQuiz: (quiz) => set({ quiz, currentIndex: 0, answers: {}, hintsUsed: {}, score: 0 }),
  loadQuizForLesson: (lesson) =>
    set({ quiz: generateQuizFromLesson(lesson), currentIndex: 0, answers: {}, hintsUsed: {}, score: 0 }),
  setAnswer: (questionId, answer) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: answer } })),
  useHint: (questionId) =>
    set((s) => ({ hintsUsed: { ...s.hintsUsed, [questionId]: true } })),
  nextQuestion: () => set((s) => ({ currentIndex: s.currentIndex + 1 })),
  setScore: (score) => set({ score }),
  reset: () => set({ quiz: [], currentIndex: 0, answers: {}, hintsUsed: {}, score: 0 }),
}));
