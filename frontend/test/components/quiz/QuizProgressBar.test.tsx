import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import QuizProgressBar from "@/components/quiz/QuizProgressBar";

describe("QuizProgressBar", () => {
  it("renders the question count and label", () => {
    render(<QuizProgressBar current={3} total={5} label="Multi-Qubit Gates" />);
    expect(screen.getByText("Question 3 of 5")).toBeInTheDocument();
    expect(screen.getByText("Multi-Qubit Gates")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  });
});
