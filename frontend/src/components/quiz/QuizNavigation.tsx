"use client";

import { Button } from "@/components/ui/button";

export default function QuizNavigation({
  canGoBack,
  canGoNext,
  isLast,
  onBack,
  onNext,
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
      <Button type="button" variant="outline" disabled={!canGoBack} onClick={onBack}>
        Previous
      </Button>
      <Button type="button" disabled={!canGoNext} onClick={onNext}>
        {isLast ? "Submit" : "Next"}
      </Button>
    </div>
  );
}
