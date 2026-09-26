"use client";

import { useLearningStore } from "@/stores/learningStore";
import { useApiHealth } from "@/hooks/useApiHealth";

function averageMastery(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function StatusBar() {
  const masteryScores = useLearningStore((s) => s.masteryScores);
  const health = useApiHealth();

  const mastery = Math.round(averageMastery(masteryScores) * 100);
  const dotClass =
    health === "online"
      ? "bg-success"
      : health === "offline"
        ? "bg-error"
        : "bg-warning";

  return (
    <footer className="flex h-6 items-center gap-4 bg-cyber-cyan px-3 text-xs text-background">
      <span>Level 1</span>
      <span>Mastery {mastery}%</span>
      <span
        className="ml-auto flex items-center gap-1"
        aria-label={`Backend status: ${health}`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
        {health}
      </span>
    </footer>
  );
}
