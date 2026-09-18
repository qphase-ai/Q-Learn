"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import CircuitPreview, { type CircuitSpec } from "@/components/learn/CircuitPreview";
import { useLearningStore } from "@/stores/learningStore";
import { Button } from "@/components/ui/button";

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
      <div className="p-8 text-center text-sm text-muted-foreground">
        Select a lesson to begin.
      </div>
    );
  }

  const isCompleted = (lessonProgress[activeLesson.id] ?? 0) >= 100;

  return (
    <article
      className="mx-auto max-w-[720px] p-6 font-sans leading-[1.7] text-foreground"
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {activeLesson.content}
      </ReactMarkdown>

      <footer className="mt-8 flex justify-end border-t border-border pt-4">
        {isCompleted ? (
          <span className="text-sm font-semibold text-success">✓ Completed</span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              useLearningStore.getState().markProgress(activeLesson.id, 100)
            }
          >
            Mark complete
          </Button>
        )}
      </footer>
    </article>
  );
}
