"use client";

import { useEffect } from "react";
import { CircuitBoard, CodeXml } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import ProgressHero from "./ProgressHero";
import TrackCard from "./TrackCard";
import QuantumSpinBackground from "@/components/backgrounds/QuantumSpinBackground";

export default function DashboardWorkspace() {
  const xp = useLearningStore((s) => s.xp);
  const streak = useLearningStore((s) => s.streak);
  const masteryScores = useLearningStore((s) => s.masteryScores);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadCourses = useLearningStore((s) => s.loadCourses);

  useEffect(() => {
    loadCourses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scores = Object.values(masteryScores);
  const overallMastery = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
    : 0;

  const completedLessons = Object.values(lessonProgress).filter((p) => p >= 100).length;
  const currentProgress = currentLessonId ? (lessonProgress[currentLessonId] ?? 0) : 0;

  return (
    <div className="shell-fade relative flex h-full flex-col gap-6 overflow-auto p-6">
      <QuantumSpinBackground />
      <ProgressHero
        xp={xp}
        streak={streak}
        overallMastery={overallMastery}
        currentLessonId={currentLessonId}
        currentProgress={currentProgress}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TrackCard
          title="Circuit Learning"
          icon={CircuitBoard}
          href="/circuit"
          accentClass="text-electric-purple"
          borderClass="border-electric-purple/20 hover:border-electric-purple/40"
          completedLessons={completedLessons}
          masteryPct={overallMastery}
        />
        <TrackCard
          title="Coding"
          icon={CodeXml}
          href="/code"
          accentClass="text-cyber-cyan"
          borderClass="border-cyber-cyan/20 hover:border-cyber-cyan/40"
          completedLessons={completedLessons}
          masteryPct={overallMastery}
        />
      </div>
    </div>
  );
}
