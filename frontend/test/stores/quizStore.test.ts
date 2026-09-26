import { describe, it, expect, beforeEach } from "vitest";
import { useQuizStore } from "@/stores/quizStore";
import type { LessonDetail } from "@/types";

const lesson: LessonDetail = {
  id: "l1",
  module_id: "m0",
  title: "Multi-Qubit Gates",
  content: "…",
  lesson_type: "text",
  is_pro: false,
  concepts: [
    { id: "c1", name: "CNOT Gate", description: "A two-qubit entangling gate." },
    { id: "c2", name: "Bell State", description: "A maximally entangled two-qubit state." },
  ],
};

beforeEach(() => {
  useQuizStore.getState().reset();
});

describe("quizStore", () => {
  it("loadQuizForLesson populates the quiz from the generator", () => {
    useQuizStore.getState().loadQuizForLesson(lesson);
    expect(useQuizStore.getState().quiz).toHaveLength(2);
    expect(useQuizStore.getState().currentIndex).toBe(0);
    expect(useQuizStore.getState().hintsUsed).toEqual({});
  });

  it("useHint marks the question's hint as used, once", () => {
    useQuizStore.getState().loadQuizForLesson(lesson);
    const qid = useQuizStore.getState().quiz[0].id;
    useQuizStore.getState().useHint(qid);
    expect(useQuizStore.getState().hintsUsed[qid]).toBe(true);
  });

  it("setAnswer/nextQuestion/setScore behave as before", () => {
    useQuizStore.getState().loadQuizForLesson(lesson);
    const qid = useQuizStore.getState().quiz[0].id;
    useQuizStore.getState().setAnswer(qid, "CNOT Gate");
    expect(useQuizStore.getState().answers[qid]).toBe("CNOT Gate");
    useQuizStore.getState().nextQuestion();
    expect(useQuizStore.getState().currentIndex).toBe(1);
    useQuizStore.getState().setScore(100);
    expect(useQuizStore.getState().score).toBe(100);
  });
});
