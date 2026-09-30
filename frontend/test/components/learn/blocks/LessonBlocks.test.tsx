import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { LessonBlock } from "@/types";

vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  getAccessToken: vi.fn().mockResolvedValue("tok"),
  subscribeToCircuitResult: vi.fn(),
}));

import LessonBlocks from "@/components/learn/blocks";
import { apiFetch } from "@/lib/api";
import { subscribeToCircuitResult } from "@/lib/supabase";

const circuit = { qubits: 1, classical_bits: 1, gates: [{ type: "H", targets: [0] }] };

const allBlocks: LessonBlock[] = [
  { id: "1", blockType: "heading", text: "Bell States", level: "2" },
  { id: "2", blockType: "text", body: "First paragraph.\n\nSecond paragraph." },
  { id: "3", blockType: "markdown", body: "Some **bold** text" },
  { id: "4", blockType: "math", latex: "\\alpha", displayMode: false, caption: "Amplitude" },
  { id: "5", blockType: "image", image: { url: "https://cdn.example.com/b.png", alt: "Bloch sphere" }, caption: "Fig 1" },
  { id: "6", blockType: "code", language: "python", code: "qc.h(0)", filename: "bell.py" },
  { id: "7", blockType: "callout", variant: "tip", title: "Remember", body: "Measure last." },
  { id: "8", blockType: "circuit", spec: circuit, title: "H gate" },
  {
    id: "9",
    blockType: "quiz",
    question: "What does H do?",
    questionType: "multiple_choice",
    options: [{ text: "Superposition" }, { text: "Nothing" }],
    correctAnswer: "Superposition",
    explanation: "It maps |0> to |+>.",
  },
  { id: "10", blockType: "simulation", circuit, shots: 512, view: "probabilities", title: "Try it" },
];

describe("LessonBlocks", () => {
  it("renders every registered block type", () => {
    const { container } = render(<LessonBlocks blocks={allBlocks} />);
    expect(screen.getByRole("heading", { level: 2, name: "Bell States" })).toBeInTheDocument();
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.getByRole("img", { name: "Bloch sphere" })).toHaveAttribute("src", "https://cdn.example.com/b.png");
    expect(screen.getByText("qc.h(0)")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Remember");
    expect(screen.getAllByTestId("circuit-preview")).toHaveLength(2); // circuit + simulation
    expect(screen.getByText("What does H do?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run simulation/i })).toBeInTheDocument();
  });

  it("skips unknown block types instead of crashing", () => {
    const blocks = [{ blockType: "hologram", id: "x" } as unknown as LessonBlock, allBlocks[0]];
    render(<LessonBlocks blocks={blocks} />);
    expect(screen.getByRole("heading", { name: "Bell States" })).toBeInTheDocument();
  });

  it("never renders author HTML as markup", () => {
    const { container } = render(
      <LessonBlocks
        blocks={[
          { blockType: "text", body: '<img src=x onerror="alert(1)">' },
          { blockType: "markdown", body: '<script>alert(1)</script>\n\n[x](javascript:alert(1))' },
        ]}
      />
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it("rejects non-http image URLs", () => {
    const { container } = render(
      <LessonBlocks blocks={[{ blockType: "image", image: { url: "javascript:alert(1)", alt: "x" } }]} />
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("checks a quiz answer and shows the explanation", () => {
    render(<LessonBlocks blocks={[allBlocks[8]]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Nothing" }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Not quite.");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Superposition" }));
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct!");
    expect(screen.getByRole("status")).toHaveTextContent("It maps |0> to |+>.");
  });

  it("runs a simulation through FastAPI and renders the realtime result", async () => {
    let deliver: (payload: unknown) => void = () => {};
    vi.mocked(subscribeToCircuitResult).mockImplementation((_id, cb) => {
      deliver = cb as (payload: unknown) => void;
      return vi.fn();
    });
    vi.mocked(apiFetch).mockResolvedValue({ execution_id: "e", status: "queued" });

    render(<LessonBlocks blocks={[allBlocks[9]]} />);
    fireEvent.click(screen.getByRole("button", { name: /run simulation/i }));

    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const [path, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toMatch(/^\/api\/v1\/circuits\/.+\/execute$/);
    expect(JSON.parse(String(init?.body))).toEqual({ circuit, shots: 512, name: "Try it" });

    deliver({ status: "completed", probabilities: { "0": 0.5, "1": 0.5 }, measurements: null, statevector: null, execution_time_ms: 3 });
    expect(await screen.findAllByText("50%")).toHaveLength(2);
  });
});
