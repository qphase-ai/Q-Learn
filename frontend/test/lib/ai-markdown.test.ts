import { describe, it, expect } from "vitest";
import { closeOpenStreamingSyntax, normaliseMath, safeUrl } from "@/lib/ai-markdown";

describe("normaliseMath", () => {
  it("converts \\[ \\] to $$ blocks on their own lines", () => {
    expect(normaliseMath("Energy: \\[E = mc^2\\] done")).toBe("Energy: \n$$\nE = mc^2\n$$\n done");
  });

  it("converts \\( \\) to inline $", () => {
    expect(normaliseMath("Let \\( x^2 \\) be")).toBe("Let $x^2$ be");
  });

  it("handles multiline display math", () => {
    const out = normaliseMath("\\[\n\\frac{1}{2}\n+ 1\n\\]");
    expect(out).toContain("$$");
    expect(out).toContain("\\frac{1}{2}\n+ 1");
    expect(out).not.toContain("\\[");
    expect(out).not.toContain("\\]");
  });

  it("leaves $ and $$ untouched", () => {
    const src = "Inline $a+b$ and\n$$\nc\n$$\n";
    expect(normaliseMath(src)).toBe(src);
  });

  it("does not touch math delimiters inside fenced code", () => {
    const src = "```python\nx = r'\\[1\\]' + '\\(a\\)'\n```";
    expect(normaliseMath(src)).toBe(src);
  });

  it("does not touch math delimiters inside inline code", () => {
    const src = "Use `\\(x\\)` literally";
    expect(normaliseMath(src)).toBe(src);
  });

  it("does not touch an unclosed fence", () => {
    const src = "```python\nprint('\\[x\\]')";
    expect(normaliseMath(src)).toBe(src);
  });

  it("converts math outside code but not inside in the same text", () => {
    const out = normaliseMath("\\(a\\) and `\\(b\\)`");
    expect(out).toBe("$a$ and `\\(b\\)`");
  });

  it("is idempotent", () => {
    const src = "A \\(x\\) B\n\\[\\frac{1}{2}\\]\nC `\\(c\\)` $d$\n```\n\\[z\\]\n```";
    const once = normaliseMath(src);
    expect(normaliseMath(once)).toBe(once);
  });

  it("returns empty string for empty input", () => {
    expect(normaliseMath("")).toBe("");
  });
});

describe("closeOpenStreamingSyntax", () => {
  it("closes an open code fence", () => {
    const r = closeOpenStreamingSyntax("Here:\n```python\nprint(1)");
    expect(r.pendingMath).toBe(false);
    expect(r.text).toBe("Here:\n```python\nprint(1)\n```");
  });

  it("does not add an extra newline when text ends with one", () => {
    expect(closeOpenStreamingSyntax("```py\nx\n").text).toBe("```py\nx\n```");
  });

  it("holds back an open $$ block", () => {
    const r = closeOpenStreamingSyntax("Intro text.\n\n$$\n\\frac{1}{");
    expect(r.pendingMath).toBe(true);
    expect(r.text).toBe("Intro text.");
  });

  it("holds back an open \\[ block", () => {
    const r = closeOpenStreamingSyntax("Intro.\n\\[ x^2 +");
    expect(r.pendingMath).toBe(true);
    expect(r.text).toBe("Intro.");
  });

  it("returns complete text unchanged", () => {
    const src = "Done $$a$$ and ```\ncode\n``` and \\[b\\].";
    expect(closeOpenStreamingSyntax(src)).toEqual({ text: src, pendingMath: false });
  });

  it("ignores $$ inside code", () => {
    const src = "```\nprice $$ 5\n```";
    expect(closeOpenStreamingSyntax(src)).toEqual({ text: src, pendingMath: false });
  });

  it("handles empty text", () => {
    expect(closeOpenStreamingSyntax("")).toEqual({ text: "", pendingMath: false });
  });
});

describe("safeUrl", () => {
  it.each([
    "https://example.com/a?b=1",
    "http://example.com",
    "mailto:a@b.co",
    "/learn/lesson-1",
    "relative/path",
    "../up",
    "#section",
    "?q=1",
  ])("allows %s", (u) => {
    expect(safeUrl(u)).toBe(u);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "java\u200bscript:alert(1)",
    "\u0001javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "DaTa:text/html;base64,AAAA",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "",
    "   ",
  ])("blocks %j", (u) => {
    expect(safeUrl(u)).toBe("");
  });
});
