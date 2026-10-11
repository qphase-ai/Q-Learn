"use client";

import { cn } from "@/lib/utils";
import type { TutorMessage } from "@/types";
import AIResponse from "@/components/markdown/AIResponse";
import CitationBadge from "@/components/tutor/CitationBadge";

/**
 * One turn in the tutor conversation. Assistant turns render markdown + KaTeX
 * (same pipeline as the lesson renderer) and any grounding citations; user
 * turns render as a plain accented bubble.
 */
export default function ChatMessage({
  message,
  streaming = false,
}: {
  message: TutorMessage;
  streaming?: boolean;
}) {
  const isUser = message.role === "user";
  const citations = message.citations ?? [];

  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-lg px-3 py-2 text-sm leading-[1.6]",
          isUser
            ? "bg-cyber-cyan/15 text-foreground"
            : message.error
              ? "border border-error/40 bg-error/10 text-error"
              : "bg-overlay/[0.03] text-foreground"
        )}
      >
        {isUser || message.error ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <AIResponse variant="chat" content={message.content} streaming={streaming} />
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
