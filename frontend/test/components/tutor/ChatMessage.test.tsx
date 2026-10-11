import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TutorMessage } from "@/types";

// KaTeX relies on CSS which jsdom doesn't fully support — mock the stylesheet import
vi.mock("katex/dist/katex.min.css", () => ({}));

import ChatMessage from "@/components/tutor/ChatMessage";

const base: TutorMessage = {
  id: "m1",
  role: "assistant",
  content: "# Superposition\n\nA qubit can be $\\alpha|0\\rangle + \\beta|1\\rangle$.",
  citations: [],
};

describe("ChatMessage", () => {
  it("renders markdown content", async () => {
    render(<ChatMessage message={base} />);
    expect(
      await screen.findByRole("heading", { name: /superposition/i })
    ).toBeInTheDocument();
  });

  it("renders inline math as a KaTeX element", async () => {
    const { container } = render(<ChatMessage message={base} />);
    await screen.findByRole("heading", { name: /superposition/i });
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("renders a CitationBadge with title and external link", () => {
    const message: TutorMessage = {
      ...base,
      content: "See the docs.",
      citations: [{ title: "The Hadamard Gate", url: "https://q.example/h", score: 0.9 }],
    };
    render(<ChatMessage message={message} />);
    const link = screen.getByRole("link", { name: /hadamard gate/i });
    expect(link).toHaveAttribute("href", "https://q.example/h");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders a citation without a link when url is null", () => {
    const message: TutorMessage = {
      ...base,
      content: "Local source.",
      citations: [{ title: "Lesson: Measurement", url: null, score: 0.7 }],
    };
    render(<ChatMessage message={message} />);
    expect(screen.getByText(/measurement/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders a user message as a plain bubble without markdown", () => {
    const message: TutorMessage = { id: "u1", role: "user", content: "What is **a qubit** and $x^2$?" };
    const { container } = render(<ChatMessage message={message} />);
    expect(screen.getByText("What is **a qubit** and $x^2$?")).toBeInTheDocument();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.querySelector(".ai-markdown")).toBeNull();
  });

  it("renders an error message as plain text in an error bubble", () => {
    const message: TutorMessage = { id: "e1", role: "assistant", content: "Something **failed**", error: true };
    const { container } = render(<ChatMessage message={message} />);
    expect(screen.getByText("Something **failed**")).toBeInTheDocument();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector(".text-error")).not.toBeNull();
  });

  it("renders assistant display math, code and a table together", () => {
    const message: TutorMessage = {
      id: "a2",
      role: "assistant",
      content:
        "Result:\n\\[\\frac{1}{\\sqrt{2}}\\]\n\n```python\nqc.h(0)\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |",
    };
    const { container } = render(<ChatMessage message={message} />);
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.querySelector("div.ai-codeblock")).not.toBeNull();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.textContent).not.toContain("\\[");
  });

  it("shows citation badges alongside rendered markdown", async () => {
    const message: TutorMessage = {
      ...base,
      citations: [
        { title: "Source A", url: null, score: 0.9 },
        { title: "Source B", url: "https://q.example/b", score: 0.8 },
      ],
    };
    const { container } = render(<ChatMessage message={message} />);
    expect(await screen.findByText("Source A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /source b/i })).toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
