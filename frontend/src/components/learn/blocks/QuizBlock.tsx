"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BlockProps } from "./types";

/** An inline check-your-understanding question; answers stay client-side. */
export default function QuizBlock({ question, options, correctAnswer, hint, explanation }: BlockProps<"quiz">) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const correct = submitted && selected === correctAnswer;

  return (
    <section aria-label="Quiz question" className="my-6 rounded-md border border-overlay/10 bg-surface p-4">
      <p className="mb-3 font-medium">{question}</p>
      <div role="radiogroup" className="flex flex-col gap-2">
        {options.map((option, i) => {
          const isSelected = selected === option.text;
          return (
            <button
              key={option.id ?? i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={submitted}
              onClick={() => setSelected(option.text)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                isSelected ? "border-cyber-cyan bg-cyber-cyan/10" : "border-overlay/10 hover:bg-overlay/5",
                submitted && option.text === correctAnswer && "border-success bg-success/10"
              )}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {!submitted ? (
          <Button type="button" size="sm" variant="outline" disabled={!selected} onClick={() => setSubmitted(true)}>
            Check answer
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setSubmitted(false);
              setSelected(null);
            }}
          >
            Try again
          </Button>
        )}
        {hint && !submitted && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowHint((v) => !v)}>
            {showHint ? "Hide hint" : "Hint"}
          </Button>
        )}
      </div>
      {showHint && hint && !submitted && <p className="mt-2 text-sm text-warning">{hint}</p>}
      {submitted && (
        <p role="status" className={cn("mt-3 text-sm font-semibold", correct ? "text-success" : "text-error")}>
          {correct ? "Correct!" : "Not quite."}
          {explanation && <span className="mt-1 block font-normal text-muted-foreground">{explanation}</span>}
        </p>
      )}
    </section>
  );
}
