import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// KaTeX css isn't needed in jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));

import AIResponse from "@/components/markdown/AIResponse";

const RAW_TEX = [/\\frac/, /\\sqrt/, /\\rangle/, /\\lvert/, /\\begin/];

function noRawTex(text: string | null) {
  for (const re of RAW_TEX) {
    // KaTeX keeps the TeX source only in <annotation>; strip it before checking.
    expect(text ?? "").not.toMatch(re);
  }
}

/** textContent with KaTeX's MathML annotation (which holds source TeX) removed. */
function visibleText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("annotation, .katex-mathml").forEach((n) => n.remove());
  return clone.textContent ?? "";
}

describe("AIResponse basics", () => {
  it("renders headings, paragraphs and nested lists", () => {
    const md = "# Title\n\n## Sub\n\nA paragraph.\n\n- one\n  - nested a\n  - nested b\n- two\n\n1. first\n2. second";
    const { container } = render(<AIResponse content={md} />);
    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sub" })).toBeInTheDocument();
    expect(screen.getByText("A paragraph.")).toBeInTheDocument();
    expect(container.querySelectorAll("ul ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
  });

  it("renders nothing for an empty string", () => {
    const { container } = render(<AIResponse content="" />);
    expect(container.firstChild).toBeNull();
  });

  it("applies variant wrapper classes", () => {
    const { container, rerender } = render(<AIResponse content="hi" variant="chat" />);
    expect(container.querySelector("div.ai-markdown.ai-markdown-chat")).not.toBeNull();
    rerender(<AIResponse content="hi" variant="page" />);
    expect(container.querySelector("div.ai-markdown.ai-markdown-page")).not.toBeNull();
  });

  it("renders inline code with the inline class", () => {
    const { container } = render(<AIResponse content="Use `qc.h(0)` here" />);
    const code = container.querySelector("code.ai-inline-code");
    expect(code).toHaveTextContent("qc.h(0)");
  });
});

describe("AIResponse math", () => {
  it("renders inline and display math with KaTeX and no raw TeX", () => {
    const md = "Inline $\\sqrt{2}$ here.\n\n$$\n\\frac{1}{\\sqrt{2}}(|0\\rangle + |1\\rangle)\n$$\n";
    const { container } = render(<AIResponse content={md} />);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.querySelector(".katex-display")).not.toBeNull();
    noRawTex(visibleText(container));
  });

  it("renders pmatrix and aligned environments", () => {
    const md =
      "$$\nH = \\frac{1}{\\sqrt{2}}\\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}\n$$\n\n" +
      "$$\n\\begin{aligned} a &= b + c \\\\ d &= e \\end{aligned}\n$$\n";
    const { container } = render(<AIResponse content={md} />);
    expect(container.querySelectorAll(".katex-display")).toHaveLength(2);
    expect(container.querySelector(".katex-error")).toBeNull();
    noRawTex(visibleText(container));
  });

  it("renders \\[ \\] and \\( \\) delimiters as math", () => {
    const md = "Inline \\(\\sqrt{x}\\) and display:\n\\[\\frac{a}{b}\\]\nend";
    const { container } = render(<AIResponse content={md} />);
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
    const text = visibleText(container);
    noRawTex(text);
    expect(text).not.toContain("\\[");
    expect(text).not.toContain("\\(");
  });

  it("does not throw on malformed LaTeX and still renders neighbours", () => {
    const md = "Before text.\n\nBroken $\\frac{1}{$ here.\n\nAfter paragraph with $x^2$.";
    expect(() => render(<AIResponse content={md} />)).not.toThrow();
    expect(screen.getByText(/Before text\./)).toBeInTheDocument();
    expect(screen.getByText(/After paragraph/)).toBeInTheDocument();
  });
});

describe("AIResponse code blocks", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  it("highlights Python, shows language label and copies exact source", async () => {
    const src = "import numpy as np\n\ndef f(x):\n    return x  # comment\n";
    const { container } = render(<AIResponse content={"```python\n" + src + "```"} />);
    const block = container.querySelector("div.ai-codeblock");
    expect(block).not.toBeNull();
    expect(block).toHaveTextContent("python");
    const code = block!.querySelector("code")!;
    expect(code.className).toMatch(/hljs/);
    expect(code.querySelector(".hljs-keyword")).not.toBeNull();

    const btn = await screen.findByRole("button", { name: "Copy code" });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(writeText).toHaveBeenCalledWith(src.replace(/\n$/, ""));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("reverts Copied back to Copy code after ~1.5s", async () => {
    vi.useFakeTimers();
    render(<AIResponse content={"```python\nx = 1\n```"} />);
    const btn = screen.getByRole("button", { name: "Copy code" });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  it("keeps JSON with quotes, braces and escaped newlines verbatim", () => {
    const json = '{\n  "name": "q\\n0",\n  "gates": [{"type": "h", "qubits": [0]}]\n}';
    const { container } = render(<AIResponse content={"```json\n" + json + "\n```"} />);
    expect(container.querySelector("div.ai-codeblock code")!.textContent).toBe(json + "\n");
    expect(container.querySelector("div.ai-codeblock")).toHaveTextContent("json");
  });

  it("labels fences without a language as text", () => {
    const { container } = render(<AIResponse content={"```\nplain\n```"} />);
    expect(container.querySelector("div.ai-codeblock")).toHaveTextContent("text");
  });

  it("does not show Copy without a clipboard API", () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    render(<AIResponse content={"```python\nx = 1\n```"} />);
    expect(screen.queryByRole("button", { name: "Copy code" })).toBeNull();
  });
});

describe("AIResponse tables", () => {
  it("renders GFM tables with rows and columns", () => {
    const md = "| Gate | Effect |\n|---|---|\n| H | superposition |\n| X | flip |\n| Z | phase |";
    const { container } = render(<AIResponse content={md} />);
    expect(container.querySelectorAll("thead th")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(container.querySelectorAll("tbody tr:first-child td")).toHaveLength(2);
    expect(container.textContent).not.toContain("|---|");
  });
});

describe("AIResponse streaming", () => {
  it("renders an unclosed code fence as code", () => {
    const { container } = render(<AIResponse streaming content={"Look:\n```python\nprint('hi')"} />);
    expect(container.querySelector("div.ai-codeblock")).not.toBeNull();
    expect(container.querySelector("div.ai-codeblock code")).toHaveTextContent("print('hi')");
    expect(container.textContent).not.toContain("```");
  });

  it("holds back an incomplete $$ block, keeps prior content, then renders it after streaming ends", () => {
    const partial = "Intro paragraph.\n\n$$\n\\frac{1}{\\sqrt{2}";
    const { container, rerender } = render(<AIResponse streaming content={partial} />);
    expect(screen.getByText("Intro paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Rendering equation…")).toBeInTheDocument();
    expect(container.textContent).not.toContain("\\frac");
    expect(container.querySelector(".katex-display")).toBeNull();

    const full = partial + "}\n$$\n\nOutro.";
    rerender(<AIResponse streaming content={full} />);
    expect(screen.queryByText("Rendering equation…")).toBeNull();
    expect(container.querySelector(".katex-display")).not.toBeNull();

    rerender(<AIResponse streaming={false} content={full} />);
    expect(screen.queryByText("Rendering equation…")).toBeNull();
    expect(container.querySelector(".katex-display")).not.toBeNull();
    expect(screen.getByText("Outro.")).toBeInTheDocument();
  });

  it("renders the whole message once streaming ends even if it ends mid-block", () => {
    const { container } = render(<AIResponse streaming={false} content={"Hello\n```python\nx = 1"} />);
    expect(container.querySelector("code")).toHaveTextContent("x = 1");
  });
});

describe("AIResponse safety", () => {
  it("does not render <script> or <img onerror> as elements", () => {
    const md = 'Hi <script>alert(1)</script> <img src=x onerror="alert(1)"> there';
    const { container } = render(<AIResponse content={md} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("drops the href on javascript: links", () => {
    const { container } = render(<AIResponse content="[click](javascript:alert(1))" />);
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("click").tagName).toBe("SPAN");
    expect(container.querySelector("[href]")).toBeNull();
  });

  it("opens external links safely in a new tab", () => {
    render(<AIResponse content="[docs](https://example.com/x)" />);
    const a = screen.getByRole("link", { name: "docs" });
    expect(a).toHaveAttribute("href", "https://example.com/x");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("keeps relative links in the same tab", () => {
    render(<AIResponse content="[lesson](/learn/1)" />);
    const a = screen.getByRole("link", { name: "lesson" });
    expect(a).toHaveAttribute("href", "/learn/1");
    expect(a).not.toHaveAttribute("target");
  });
});

describe("AIResponse callouts", () => {
  it("renders a Key takeaway blockquote as a callout", () => {
    const { container } = render(<AIResponse content={"> **Key takeaway:** Measurement collapses the state."} />);
    const aside = container.querySelector("aside[role='note']");
    expect(aside).not.toBeNull();
    expect(aside).toHaveAttribute("data-callout", "takeaway");
    expect(aside).toHaveTextContent("Measurement collapses the state.");
  });

  it("detects warning and tip callouts and leaves plain quotes alone", () => {
    const { container } = render(
      <AIResponse content={"> **Warning:** careful\n\n> **Tip:** try this\n\n> just a quote"} />,
    );
    expect(container.querySelector("aside[data-callout='warning']")).not.toBeNull();
    expect(container.querySelector("aside[data-callout='tip']")).not.toBeNull();
    expect(container.querySelectorAll("blockquote")).toHaveLength(1);
  });
});

describe("AIResponse Bell-state fixture", () => {
  const fixture = `# Creating a Bell State

A **Bell state** is a maximally entangled two-qubit state.

## Step 1: Superposition

Apply a Hadamard to qubit 0:

\\[
\\lvert \\psi_0 \\rangle = \\lvert 00 \\rangle
\\]

\\[
\\lvert \\psi_1 \\rangle = \\frac{1}{\\sqrt{2}} \\left( \\lvert 00 \\rangle + \\lvert 10 \\rangle \\right)
\\]

## Step 2: Entangle

\\[
\\lvert \\psi_2 \\rangle = \\frac{1}{\\sqrt{2}} \\left( \\lvert 00 \\rangle + \\lvert 11 \\rangle \\right)
\\]

\`\`\`python
from qiskit import QuantumCircuit

qc = QuantumCircuit(2)
qc.h(0)
qc.cx(0, 1)
\`\`\`

| Gate | Effect |
|---|---|
| H | Puts qubit 0 in superposition |
| CNOT | Entangles qubit 1 with qubit 0 |

**Key takeaway:** entanglement correlates measurement outcomes.
`;

  it("renders every content type with no raw markup left", () => {
    const { container } = render(<AIResponse content={fixture} variant="page" />);
    expect(screen.getByRole("heading", { level: 1, name: "Creating a Bell State" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(container.querySelectorAll(".katex-display")).toHaveLength(3);
    const codeBlock = container.querySelector("div.ai-codeblock")!;
    expect(codeBlock).toHaveTextContent("python");
    expect(codeBlock.querySelector("code")!.className).toMatch(/hljs/);
    expect(codeBlock.querySelector("code")).toHaveTextContent("qc.cx(0, 1)");
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("H");
    expect(rows[1]).toHaveTextContent("CNOT");
    expect(screen.getByText(/Key takeaway:/)).toBeInTheDocument();
    expect(container.querySelector("strong")).not.toBeNull();

    const text = visibleText(container);
    expect(text).not.toContain("\\[");
    expect(text).not.toContain("\\]");
    expect(text).not.toContain("|---|");
    noRawTex(text);
  });
});


describe("AIResponse circuit fences", () => {
  it.each([
    ["missing gates", '{"qubits": 2}'],
    ["array instead of object", "[]"],
    ["non-object gates", '{"qubits": 2, "gates": [1]}'],
    ["malformed JSON", '{"qubits": 2,'],
    ["huge qubit count", '{"qubits": 1000000000, "gates": []}'],
    ["non-finite qubits", '{"qubits": 1e999, "gates": []}'],
    ["fractional qubits", '{"qubits": 1.5, "gates": []}'],
    ["out-of-range target", '{"qubits": 2, "gates": [{"type": "H", "targets": [5]}]}'],
    ["bad control", '{"qubits": 2, "gates": [{"type": "CX", "targets": [0], "control": -1}]}'],
    ["empty targets", '{"qubits": 2, "gates": [{"type": "H", "targets": []}]}'],
    ["gate without type", '{"qubits": 2, "gates": [{"targets": [0]}]}'],
  ])("falls back to a code block for an invalid spec (%s)", (_name, json) => {
    const { container } = render(<AIResponse content={"```circuit\n" + json + "\n```"} />);
    expect(container.querySelector(".ai-codeblock")).not.toBeNull();
  });
});

describe("AIResponse valid circuit fences", () => {
  it("renders a CircuitPreview for a bounded, well-formed spec", () => {
    const json = '{"qubits": 2, "gates": [{"type": "H", "targets": [0]}, {"type": "CX", "targets": [1], "control": 0}]}';
    const { container } = render(<AIResponse content={"```circuit\n" + json + "\n```"} />);
    expect(container.querySelector(".ai-codeblock")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
