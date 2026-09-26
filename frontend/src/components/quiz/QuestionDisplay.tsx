"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { QuizQuestion } from "@/types/quiz";

export default function QuestionDisplay({ question }: { question: QuizQuestion }) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {question.question_text}
      </ReactMarkdown>
    </div>
  );
}
