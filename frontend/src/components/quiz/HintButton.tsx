"use client";

import { Lightbulb } from "lucide-react";

/** One hint per question; showing it does not affect mastery scoring. */
export default function HintButton({
  hint,
  used,
  onUse,
}: {
  hint: string;
  used: boolean;
  onUse: () => void;
}) {
  if (used) {
    return (
      <p className="mx-auto w-full max-w-2xl rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
        <span className="font-medium text-warning">Hint: </span>
        {hint}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button
        type="button"
        onClick={onUse}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-warning hover:bg-warning/10"
      >
        <Lightbulb size={13} aria-hidden />
        Show hint
      </button>
    </div>
  );
}
