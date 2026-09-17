import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useLearningStore } from "@/stores/learningStore";
import type { LessonDetail } from "@/types";

// KaTeX relies on CSS which jsdom doesn't fully support — mock the stylesheet import
vi.mock("katex/dist/katex.min.css", () => ({}));

// react-markdown uses ESM; vitest handles it via the plugin but we need this
// to avoid issues with the katex stylesheet import in LessonContent
import LessonContent from "@/components/learn/LessonContent";

const circuitFence = `\`\`\`circuit
{"qubits":2,"gates":[{"type":"H","targets":[0]},{"type":"CX","targets":[1],"control":0}]}
\`\`\``;

const fakeLesson: LessonDetail = {
  id: "lesson-1",
  module_id: "mod-1",
  title: "Intro to Superposition",
  content: `# Superposition\n\nSome math: $\\alpha|0\\rangle$\n\n${circuitFence}`,
  lesson_type: "text",
  is_pro: false,
  concepts: [],
};

beforeEach(() => {
  useLearningStore.setState({ activeLesson: null });
});

describe("LessonContent", () => {
  it("shows empty-state when activeLesson is null", () => {
    render(<LessonContent />);
    expect(screen.getByText(/select a lesson/i)).toBeInTheDocument();
  });

  it("renders the heading from lesson content", async () => {
    useLearningStore.setState({ activeLesson: fakeLesson });
    render(<LessonContent />);
    expect(await screen.findByRole("heading", { name: /superposition/i })).toBeInTheDocument();
  });

  it("renders a KaTeX element for inline math", async () => {
    useLearningStore.setState({ activeLesson: fakeLesson });
    const { container } = render(<LessonContent />);
    // Wait for async rendering
    await screen.findByRole("heading", { name: /superposition/i });
    const katexEl = container.querySelector(".katex");
    expect(katexEl).not.toBeNull();
  });

  it("renders a CircuitPreview (svg[data-testid=circuit-preview]) for circuit fences", async () => {
    useLearningStore.setState({ activeLesson: fakeLesson });
    render(<LessonContent />);
    await screen.findByRole("heading", { name: /superposition/i });
    expect(screen.getByTestId("circuit-preview")).toBeInTheDocument();
  });

  it("renders empty-state when content is null", () => {
    useLearningStore.setState({
      activeLesson: { ...fakeLesson, content: null },
    });
    render(<LessonContent />);
    expect(screen.getByText(/select a lesson/i)).toBeInTheDocument();
  });

  it("renders empty-state (no crash) when content is undefined", () => {
    useLearningStore.setState({
      activeLesson: { ...fakeLesson, content: undefined as unknown as string },
    });
    render(<LessonContent />);
    expect(screen.getByText(/select a lesson/i)).toBeInTheDocument();
  });

  it("renders empty-state when content is an empty string", () => {
    useLearningStore.setState({
      activeLesson: { ...fakeLesson, content: "" },
    });
    render(<LessonContent />);
    expect(screen.getByText(/select a lesson/i)).toBeInTheDocument();
  });

  it("falls back to a code block on invalid circuit JSON", async () => {
    useLearningStore.setState({
      activeLesson: {
        ...fakeLesson,
        content: "# Test\n\n```circuit\nnot-valid-json\n```",
      },
    });
    render(<LessonContent />);
    await screen.findByRole("heading", { name: /test/i });
    // CircuitPreview should NOT be present
    expect(screen.queryByTestId("circuit-preview")).toBeNull();
    // The raw code should be shown
    expect(screen.getByText("not-valid-json")).toBeInTheDocument();
  });
});
