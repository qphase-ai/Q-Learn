"use client";

import AIResponse from "@/components/markdown/AIResponse";
import type { QuizQuestion } from "@/types/quiz";

export default function QuestionDisplay({ question }: { question: QuizQuestion }) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-overlay/10 bg-overlay/[0.03] p-6">
      <AIResponse variant="page" content={question.question_text} />
    </div>
  );
}
