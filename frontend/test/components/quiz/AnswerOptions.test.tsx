import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnswerOptions from "@/components/quiz/AnswerOptions";

describe("AnswerOptions", () => {
  it("renders a radio group and calls onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AnswerOptions options={["CNOT Gate", "Bell State"]} selected={null} onSelect={onSelect} />);
    await user.click(screen.getByRole("radio", { name: "Bell State" }));
    expect(onSelect).toHaveBeenCalledWith("Bell State");
  });

  it("marks the selected option checked", () => {
    render(<AnswerOptions options={["CNOT Gate", "Bell State"]} selected="CNOT Gate" onSelect={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "CNOT Gate" })).toBeChecked();
  });
});
