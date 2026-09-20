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
});
