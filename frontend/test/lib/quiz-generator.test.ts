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

describe("generateQuizFromLesson — CMS quiz blocks", () => {
  it("prefers questions authored as quiz blocks", () => {
    const quiz = generateQuizFromLesson({
      id: "ref-1",
      module_id: "m",
      title: "Superposition",
      content: null,
      lesson_type: "quiz",
      is_pro: false,
      concepts: [{ id: "c1", name: "Superposition", description: "d" }],
      blocks: [
        { blockType: "markdown", body: "intro" },
        {
          id: "b1",
          blockType: "quiz",
          question: "P(0) for |+>?",
          questionType: "multiple_choice",
          options: [{ text: "0.5" }, { text: "1" }],
          correctAnswer: "0.5",
          hint: "Equal amplitudes",
          concept: "superposition",
        },
      ],
    });
    expect(quiz).toEqual([
      {
        id: "q-ref-1-b1",
        concept_id: "superposition",
        question_text: "P(0) for |+>?",
        question_type: "multiple_choice",
        options: ["0.5", "1"],
        correct_answer: "0.5",
        hint: "Equal amplitudes",
      },
    ]);
  });
});
