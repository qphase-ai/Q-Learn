import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuestionDisplay from "@/components/quiz/QuestionDisplay";
import type { QuizQuestion } from "@/types/quiz";

const question: QuizQuestion = {
  id: "q-c1",
  concept_id: "c1",
  question_text: "Which concept does this describe: \"A two-qubit entangling gate.\"?",
  question_type: "multiple_choice",
  options: ["CNOT Gate", "Bell State"],
  correct_answer: "CNOT Gate",
  hint: "A two-qubit entangling gate.",
};

describe("QuestionDisplay", () => {
  it("renders the question text", () => {
    render(<QuestionDisplay question={question} />);
    expect(screen.getByText(question.question_text)).toBeInTheDocument();
  });
});
