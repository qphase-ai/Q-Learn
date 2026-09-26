import { describe, it, expect } from "vitest";
import { generateQuizFromLesson } from "@/lib/quiz-generator";
import type { LessonDetail } from "@/types";

describe("generateQuizFromLesson", () => {
  it("builds one multiple-choice question per concept when there are 2+ concepts", () => {
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

    const quiz = generateQuizFromLesson(lesson);

    expect(quiz).toHaveLength(2);
    expect(quiz[0].question_type).toBe("multiple_choice");
    expect(quiz[0].correct_answer).toBe("CNOT Gate");
    expect(quiz[0].options).toEqual(expect.arrayContaining(["CNOT Gate", "Bell State"]));
    expect(quiz[0].concept_id).toBe("c1");
    expect(quiz[0].hint).toContain("entangling gate");
  });

  it("falls back to a true/false question when the lesson has fewer than 2 concepts", () => {
    const lesson: LessonDetail = {
      id: "l2",
      module_id: "m0",
      title: "Single Qubit Gates",
      content: "…",
      lesson_type: "text",
      is_pro: false,
      concepts: [{ id: "c1", name: "Hadamard Gate", description: "Creates superposition." }],
    };

    const quiz = generateQuizFromLesson(lesson);

    expect(quiz).toHaveLength(1);
    expect(quiz[0].question_type).toBe("true_false");
    expect(quiz[0].options).toEqual(["True", "False"]);
    expect(quiz[0].correct_answer).toBe("True");
  });

  it("returns an empty quiz for a lesson with no concepts", () => {
    const lesson: LessonDetail = {
      id: "l3",
      module_id: "m0",
      title: "Intro",
      content: "…",
      lesson_type: "text",
      is_pro: false,
      concepts: [],
    };
    expect(generateQuizFromLesson(lesson)).toEqual([]);
  });
});
