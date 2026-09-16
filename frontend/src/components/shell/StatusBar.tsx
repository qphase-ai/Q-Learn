"use client";

import { useEffect, useState } from "react";
import { useLearningStore } from "@/stores/learningStore";

type Health = "checking" | "online" | "offline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function averageMastery(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function StatusBar() {
  const masteryScores = useLearningStore((s) => s.masteryScores);
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health`)
      .then((res) => {
        if (!cancelled) setHealth(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setHealth("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mastery = Math.round(averageMastery(masteryScores) * 100);
  const dotColor =
    health === "online"
      ? "var(--success)"
      : health === "offline"
        ? "var(--error)"
        : "var(--warning)";

  return (
    <footer className="flex h-6 items-center gap-4 bg-[var(--quantum)] px-3 text-xs text-[var(--bg-base)]">
      <span>Level 1</span>
      <span>Mastery {mastery}%</span>
      <span
        className="ml-auto flex items-center gap-1"
        aria-label={`Backend status: ${health}`}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        {health}
      </span>
    </footer>
  );
}
