import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizWorkspace from "@/components/quiz/QuizWorkspace";
import { useLearningStore } from "@/stores/learningStore";
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

const updateMastery = vi.fn();

beforeEach(() => {
  updateMastery.mockClear();
  useLearningStore.setState({ activeLesson: lesson, updateMastery });
  useQuizStore.getState().reset();
});

describe("QuizWorkspace", () => {
  it("loads the quiz for the active lesson and shows question 1 of N", () => {
    render(<QuizWorkspace />);
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
  });

  it("selecting an answer and clicking Next advances to question 2", async () => {
    const user = userEvent.setup();
    render(<QuizWorkspace />);
    const firstOption = useQuizStore.getState().quiz[0].options[0];
    await user.click(screen.getByRole("radio", { name: firstOption }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
  });

  it("submitting the last question scores the quiz and updates mastery per concept", async () => {
    const user = userEvent.setup();
    render(<QuizWorkspace />);

    const q1 = useQuizStore.getState().quiz[0];
    await user.click(screen.getByRole("radio", { name: q1.correct_answer }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    const q2 = useQuizStore.getState().quiz[1];
    await user.click(screen.getByRole("radio", { name: q2.correct_answer }));
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(useQuizStore.getState().score).toBe(100);
    expect(updateMastery).toHaveBeenCalledWith("c1", 1);
    expect(updateMastery).toHaveBeenCalledWith("c2", 1);
    expect(screen.getByText(/quiz complete/i)).toBeInTheDocument();
  });
});
