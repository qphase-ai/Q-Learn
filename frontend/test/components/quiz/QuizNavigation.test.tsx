import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizNavigation from "@/components/quiz/QuizNavigation";

describe("QuizNavigation", () => {
  it("disables Previous on the first question and calls onNext for Next", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<QuizNavigation canGoBack={false} isLast={false} onBack={vi.fn()} onNext={onNext} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows Submit instead of Next on the last question", () => {
    render(<QuizNavigation canGoBack isLast onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });
});
