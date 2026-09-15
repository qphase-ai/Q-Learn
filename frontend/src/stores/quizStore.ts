import { create } from "zustand";

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
}

interface QuizStore {
  quiz: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  score: number;
  setQuiz: (quiz: QuizQuestion[]) => void;
  setAnswer: (questionId: string, answer: string) => void;
  nextQuestion: () => void;
  setScore: (score: number) => void;
  reset: () => void;
}

export const useQuizStore = create<QuizStore>((set) => ({
  quiz: [],
  currentIndex: 0,
  answers: {},
  score: 0,
  setQuiz: (quiz) => set({ quiz, currentIndex: 0, answers: {}, score: 0 }),
  setAnswer: (questionId, answer) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: answer } })),
  nextQuestion: () => set((s) => ({ currentIndex: s.currentIndex + 1 })),
  setScore: (score) => set({ score }),
  reset: () => set({ quiz: [], currentIndex: 0, answers: {}, score: 0 }),
}));
