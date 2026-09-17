"use client";

import { useLearningStore } from "@/stores/learningStore";

export default function XPProgressBar() {
  const xp = useLearningStore((s) => s.xp);
  const streak = useLearningStore((s) => s.streak);
  const pct = xp % 100; // progress toward the next 100-XP level

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
      <span>{xp} XP</span>
      <div
        className="h-1.5 w-24 overflow-hidden rounded-sm bg-[var(--bg-elevated)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-[var(--quantum)]" style={{ width: `${pct}%` }} />
      </div>
      <span>🔥 {streak}</span>
    </div>
  );
}
