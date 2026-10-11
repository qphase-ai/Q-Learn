/**
 * Pure helpers for rendering AI-written Markdown (tutor chat, generated quiz
 * text). No React, no DOM: everything here is unit-testable.
 */

// Code the model writes: fenced blocks (an unclosed fence runs to the end of
// the text) and inline spans. Math delimiters in code are never touched.
// Mirrors `_CODE_RE` in backend/app/agents/tutor.py.
const CODE_RE = /```[\s\S]*?(?:```|$)|(`+)[^\n]*?\1/g;

// \[…\] or $$…$$ (display), \(…\) or $…$ (inline). Mirrors `_MATH_RE`.
const MATH_RE =
  /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([^\n]+?)\\\)|(?<!\$)\$([^$\n]+?)\$/g;

function codeSpans(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  const re = new RegExp(CODE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++;
  }
  return spans;
}

function normaliseMathSpan(text: string): string {
  return text.replace(
    MATH_RE,
    (match: string, d1?: string, d2?: string, i1?: string, i2?: string, offset?: number, whole?: string) => {
      if (d2 !== undefined || i2 !== undefined) return match; // already renderable
      if (d1 !== undefined) {
        const at = offset ?? 0;
        const src = whole ?? "";
        const before = src.slice(0, at);
        const lead = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
        const next = src[at + match.length];
        const trail = next !== undefined && next !== "\n" ? "\n" : "";
        return `${lead}$$\n${d1.trim()}\n$$${trail}`;
      }
      return `$${(i1 ?? "").trim()}$`;
    },
  );
}

/**
 * Rewrite the answer's math into the delimiters remark-math understands:
 * `\[…\]` becomes `$$` on its own lines, `\(…\)` becomes `$…$`. Fenced and
 * inline code are left untouched, and text already using `$`/`$$` passes
 * through unchanged (idempotent). Port of the backend `normalise_math`,
 * minus the citation-in-math handling, which stays on the backend.
 */
export function normaliseMath(text: string): string {
  if (!text) return "";
  let out = "";
  let pos = 0;
  for (const code of codeSpans(text)) {
    out += normaliseMathSpan(text.slice(pos, code.start)) + text.slice(code.start, code.end);
    pos = code.end;
  }
  return out + normaliseMathSpan(text.slice(pos));
}

/**
 * Index of an unclosed `$$` / `\[` display opener in `segment` (text with no
 * code in it), or -1.
 */
function findUnclosedDisplay(segment: string): number {
  let i = 0;
  while (i < segment.length) {
    const dd = segment.indexOf("$$", i);
    const br = segment.indexOf("\\[", i);
    let start: number;
    let closer: string;
    if (dd === -1 && br === -1) return -1;
    if (br === -1 || (dd !== -1 && dd < br)) {
      start = dd;
      closer = "$$";
    } else {
      start = br;
      closer = "\\]";
    }
    const end = segment.indexOf(closer, start + 2);
    if (end === -1) return start;
    i = end + closer.length;
  }
  return -1;
}

/**
 * Make a half-streamed message safe to render. Call it on the full text on
 * every update; it is pure, so nothing is ever permanently dropped.
 *
 * - An odd number of ``` fences gets a closing fence appended, so code
 *   renders as code immediately.
 * - An unclosed `$$` / `\[` display block at the tail is held back: `text`
 *   stops before it and `pendingMath` is true, so the UI can show a
 *   placeholder instead of raw TeX. Once it closes (or the message
 *   completes) the next call returns everything.
 */
export function closeOpenStreamingSyntax(text: string): { text: string; pendingMath: boolean } {
  if (!text) return { text: "", pendingMath: false };

  // Only the segment after the last code span can hold a pending display block.
  let tailStart = 0;
  for (const code of codeSpans(text)) tailStart = code.end;
  const open = findUnclosedDisplay(text.slice(tailStart));
  if (open !== -1) {
    return { text: text.slice(0, tailStart + open).replace(/\s+$/, ""), pendingMath: true };
  }

  const fences = text.match(/```/g)?.length ?? 0;
  if (fences % 2 === 1) {
    return { text: `${text}${text.endsWith("\n") ? "" : "\n"}\`\`\``, pendingMath: false };
  }
  return { text, pendingMath: false };
}

// Whitespace, C0/C1 controls, soft hyphen and zero-width / line-separator chars.
const INVISIBLE_RE = new RegExp("[\\u0000-\\u0020\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028\\u2029\\ufeff]", "g");

const ALLOWED_SCHEMES = new Set(["http", "https", "mailto"]);

/**
 * react-markdown `urlTransform`: allow only http, https, mailto, relative
 * paths and #anchors. Anything else (javascript:, data:, vbscript:, ...)
 * returns "" so the link or image gets no URL.
 */
export function safeUrl(url: string): string {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  // Browsers ignore whitespace/control/zero-width chars inside the scheme
  // ("java\tscript:"), so judge the URL with them removed.
  const cleaned = trimmed.replace(INVISIBLE_RE, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("#") || cleaned.startsWith("/") || cleaned.startsWith("?")) return trimmed;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (!scheme) return trimmed; // relative path
  return ALLOWED_SCHEMES.has(scheme[1].toLowerCase()) ? trimmed : "";
}
