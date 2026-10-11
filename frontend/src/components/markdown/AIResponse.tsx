"use client";

import { Children, isValidElement, memo, useMemo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import "katex/dist/katex.min.css";
import CircuitPreview, { type CircuitSpec } from "@/components/learn/CircuitPreview";
import { closeOpenStreamingSyntax, normaliseMath, safeUrl } from "@/lib/ai-markdown";
import { cn } from "@/lib/utils";
import CodeBlock, { extractText } from "./CodeBlock";
import Callout, { type CalloutKind } from "./Callout";

export interface AIResponseProps {
  content: string;
  /** True while tokens are still arriving. */
  streaming?: boolean;
  /** "chat" is compact (tutor sidebar); "page" is roomier. */
  variant?: "chat" | "page";
}

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: NonNullable<React.ComponentProps<typeof ReactMarkdown>["rehypePlugins"]> = [
  [rehypeKatex, { throwOnError: false, strict: "ignore" }],
  [
    rehypeHighlight,
    {
      detect: false,
      ignoreMissing: true,
      languages: { bash, javascript, json, plaintext, python, sql, typescript },
    },
  ],
];

const CALLOUT_RE = /^\s*(key takeaway|takeaway|note|warning|tip)\b/i;

function calloutKind(label: string): CalloutKind {
  const l = label.toLowerCase();
  if (l.startsWith("warning")) return "warning";
  if (l.startsWith("tip")) return "tip";
  if (l.startsWith("note")) return "note";
  return "takeaway";
}

/** The callout kind if the blockquote's first paragraph starts with a bold label. */
function detectCallout(children: ReactNode): CalloutKind | null {
  const first = Children.toArray(children).find(
    (c) => isValidElement(c) || (typeof c === "string" && c.trim() !== ""),
  );
  if (!isValidElement<{ children?: ReactNode }>(first) || first.type !== "p") return null;
  const lead = Children.toArray(first.props.children)[0];
  if (!isValidElement<{ children?: ReactNode }>(lead) || lead.type !== "strong") return null;
  const match = CALLOUT_RE.exec(extractText(lead.props.children));
  return match ? calloutKind(match[1]) : null;
}

// Bounds keep a crafted fence from forcing huge SVG allocations in the browser.
const MAX_PREVIEW_QUBITS = 16;
const MAX_PREVIEW_GATES = 64;

function isQubitIndex(n: unknown, qubits: number): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < qubits;
}

function parseCircuit(raw: string): CircuitSpec | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { qubits, gates } = v as Partial<CircuitSpec>;
    if (!Number.isInteger(qubits) || (qubits as number) < 1 || (qubits as number) > MAX_PREVIEW_QUBITS) {
      return null;
    }
    if (!Array.isArray(gates) || gates.length > MAX_PREVIEW_GATES) return null;
    const n = qubits as number;
    const valid = gates.every((g) => {
      if (typeof g !== "object" || g === null || typeof g.type !== "string") return false;
      if (g.targets !== undefined && !(Array.isArray(g.targets) && g.targets.length <= n && g.targets.every((t) => isQubitIndex(t, n)))) {
        return false;
      }
      return g.control === undefined || isQubitIndex(g.control, n);
    });
    return valid ? (v as CircuitSpec) : null;
  } catch {
    return null;
  }
}

const components: Components = {
  // Block code: react-markdown renders <pre><code/></pre>; unwrap and re-render.
  pre({ children }) {
    const codeEl = Children.toArray(children).find((c) => isValidElement(c));
    if (!isValidElement<{ className?: string; children?: ReactNode }>(codeEl)) {
      return <pre>{children}</pre>;
    }
    const { className, children: codeChildren } = codeEl.props;
    const language = /language-([\w+-]+)/.exec(className ?? "")?.[1];
    if (language === "circuit") {
      const spec = parseCircuit(extractText(codeChildren).replace(/\n$/, ""));
      if (spec) return <CircuitPreview spec={spec} />;
    }
    return (
      <CodeBlock language={language} codeClassName={className}>
        {codeChildren}
      </CodeBlock>
    );
  },
  // Only inline code reaches here; block code is handled by `pre` above.
  code({ className, children }) {
    return <code className={cn("ai-inline-code", className)}>{children}</code>;
  },
  table({ children }) {
    return (
      <div className="ai-table-wrap my-3 overflow-x-auto">
        <table>{children}</table>
      </div>
    );
  },
  a({ href, children }: ComponentPropsWithoutRef<"a">) {
    const safe = href ? safeUrl(href) : "";
    if (!safe) return <span>{children}</span>;
    const external = /^(https?:)?\/\//i.test(safe) || /^mailto:/i.test(safe);
    return external ? (
      <a href={safe} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <a href={safe}>{children}</a>
    );
  },
  blockquote({ children }) {
    const kind = detectCallout(children);
    return kind ? <Callout kind={kind}>{children}</Callout> : <blockquote>{children}</blockquote>;
  },
};

function AIResponseImpl({ content, streaming = false, variant = "chat" }: AIResponseProps) {
  const { text, pendingMath } = useMemo(() => {
    const normalised = normaliseMath(content ?? "");
    return streaming ? closeOpenStreamingSyntax(normalised) : { text: normalised, pendingMath: false };
  }, [content, streaming]);

  if (!text && !pendingMath) return null;

  return (
    <div className={cn("ai-markdown", variant === "chat" ? "ai-markdown-chat" : "ai-markdown-page")} data-variant={variant}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        urlTransform={safeUrl}
      >
        {text}
      </ReactMarkdown>
      {pendingMath && <p className="text-xs italic text-muted-foreground">Rendering equation…</p>}
    </div>
  );
}

const AIResponse = memo(AIResponseImpl);
AIResponse.displayName = "AIResponse";

export default AIResponse;
