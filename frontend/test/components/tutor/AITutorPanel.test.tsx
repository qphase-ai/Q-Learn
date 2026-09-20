import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useTutorStore } from "@/stores/tutorStore";

// KaTeX css (ChatMessage → markdown pipeline) isn't needed in jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));

import AITutorPanel from "@/components/tutor/AITutorPanel";

const sendMessage = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  sendMessage.mockClear();
  useTutorStore.setState({
    messages: [],
    isStreaming: false,
    suggestedPrompts: [
      "Explain superposition with an example",
      "What is quantum entanglement?",
    ],
    sendMessage: sendMessage as unknown as (m: string) => Promise<void>,
  });
});

describe("AITutorPanel", () => {
  it("submitting the form calls sendMessage with the typed question", () => {
    render(<AITutorPanel />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "What is a qubit?" } });
    fireEvent.submit(input.closest("form")!);
    expect(sendMessage).toHaveBeenCalledWith("What is a qubit?");
  });

  it("does not send an empty/whitespace question", () => {
    render(<AITutorPanel />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("disables the input and submit while streaming", () => {
    useTutorStore.setState({ isStreaming: true });
    render(<AITutorPanel />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("clicking a suggested prompt sends that prompt", () => {
    render(<AITutorPanel />);
    fireEvent.click(screen.getByRole("button", { name: /what is quantum entanglement/i }));
    expect(sendMessage).toHaveBeenCalledWith("What is quantum entanglement?");
  });

  it("hides suggested prompts once a conversation has started", () => {
    useTutorStore.setState({
      messages: [{ id: "u1", role: "user", content: "hi" }],
    });
    render(<AITutorPanel />);
    expect(
      screen.queryByRole("button", { name: /what is quantum entanglement/i })
    ).toBeNull();
  });
});
