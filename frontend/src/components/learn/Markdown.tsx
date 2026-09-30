"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import CircuitPreview, { type CircuitSpec } from "@/components/learn/CircuitPreview";

// Custom code block renderer — a ```circuit fence renders as a CircuitPreview
const CodeBlock: Components["code"] = ({ className, children, ...props }) => {
  if (className === "language-circuit") {
    const raw = String(children).replace(/\n$/, "");
    try {
      const spec = JSON.parse(raw) as CircuitSpec;
      return <CircuitPreview spec={spec} />;
    } catch {
      // Fall back to plain code block on parse failure
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const components: Components = {
  code: CodeBlock,
};

/**
 * Author-supplied Markdown with KaTeX math. react-markdown never renders raw
 * HTML (no rehype-raw) and strips unsafe URLs, so CMS content cannot inject
 * markup — keep it that way; never pass lesson text to dangerouslySetInnerHTML.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
