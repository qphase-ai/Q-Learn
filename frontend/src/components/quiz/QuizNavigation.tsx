"use client";

import { Button } from "@/components/ui/button";

export default function QuizNavigation({
  canGoBack,
  isLast,
  onBack,
  onNext,
}: {
  canGoBack: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
      <Button type="button" variant="outline" disabled={!canGoBack} onClick={onBack}>
        Previous
      </Button>
      <Button type="button" onClick={onNext}>
        {isLast ? "Submit" : "Next"}
      </Button>
    </div>
  );
}
