"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import CircuitPreview, { type CircuitSpec } from "@/components/learn/CircuitPreview";
import { useLearningStore } from "@/stores/learningStore";

// Custom code block renderer
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

export default function LessonContent() {
  const activeLesson = useLearningStore((s) => s.activeLesson);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);

  if (!activeLesson || !activeLesson.content) {
    return (
      <div
        style={{
          color: "var(--text-muted)",
          padding: "2rem",
          textAlign: "center",
          fontSize: "0.875rem",
        }}
      >
        Select a lesson to begin.
      </div>
    );
  }

  const isCompleted = (lessonProgress[activeLesson.id] ?? 0) >= 100;

  return (
    <article
      className="font-sans"
      style={{
        color: "var(--text-primary)",
        maxWidth: "720px",
        margin: "0 auto",
        padding: "1.5rem",
        lineHeight: 1.7,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {activeLesson.content}
      </ReactMarkdown>

      <footer
        style={{
          marginTop: "2rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        {isCompleted ? (
          <span
            style={{
              color: "var(--success)",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            ✓ Completed
          </span>
        ) : (
          <button
            onClick={() =>
              useLearningStore.getState().markProgress(activeLesson.id, 100)
            }
            style={{
              background: "none",
              border: "1px solid var(--quantum)",
              color: "var(--quantum)",
              borderRadius: "4px",
              padding: "0.375rem 0.875rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Mark complete
          </button>
        )}
      </footer>
    </article>
  );
}
