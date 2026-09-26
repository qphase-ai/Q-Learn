"use client";

import { Progress } from "@/components/ui/progress";

export default function QuizProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {current} of {total}
        </span>
        <span>{label}</span>
      </div>
      <Progress
        value={pct}
        aria-label={`Quiz progress: question ${current} of ${total}`}
        className="[&>*]:bg-electric-purple"
      />
    </div>
  );
}
