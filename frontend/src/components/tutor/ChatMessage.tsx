"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import type { TutorMessage } from "@/types";
import CitationBadge from "@/components/tutor/CitationBadge";

/**
 * One turn in the tutor conversation. Assistant turns render markdown + KaTeX
 * (same pipeline as the lesson renderer) and any grounding citations; user
 * turns render as a plain accented bubble.
 */
export default function ChatMessage({ message }: { message: TutorMessage }) {
  const isUser = message.role === "user";
  const citations = message.citations ?? [];

  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-lg px-3 py-2 text-sm leading-[1.6]",
          isUser
            ? "bg-cyber-cyan/15 text-foreground"
            : "bg-white/[0.03] text-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="tutor-markdown space-y-2">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {citations.map((citation, i) => (
            <CitationBadge key={`${citation.title}-${i}`} citation={citation} />
          ))}
        </div>
      )}
    </div>
  );
}
