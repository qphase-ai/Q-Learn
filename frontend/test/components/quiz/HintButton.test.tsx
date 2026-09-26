import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HintButton from "@/components/quiz/HintButton";

describe("HintButton", () => {
  it("shows a 'Show hint' button before use, reveals the hint text after clicking, and disables further clicks", async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(<HintButton hint="A two-qubit entangling gate." used={false} onUse={onUse} />);
    await user.click(screen.getByRole("button", { name: /show hint/i }));
    expect(onUse).toHaveBeenCalledOnce();
  });

  it("shows the hint text once used", () => {
    render(<HintButton hint="A two-qubit entangling gate." used onUse={vi.fn()} />);
    expect(screen.getByText("A two-qubit entangling gate.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show hint/i })).not.toBeInTheDocument();
  });
});
