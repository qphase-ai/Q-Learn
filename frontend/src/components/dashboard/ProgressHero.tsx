import Link from "next/link";
import { Zap, Flame, Brain } from "lucide-react";

interface ProgressHeroProps {
  xp: number;
  streak: number;
  overallMastery: number;
  currentLessonId: string | null;
  currentProgress: number;
}

export default function ProgressHero({
  xp,
  streak,
  overallMastery,
  currentLessonId,
  currentProgress,
}: ProgressHeroProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-cyber-cyan" aria-hidden />
          <span className="text-lg font-semibold text-foreground">
            {xp.toLocaleString()} XP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-warning" aria-hidden />
          <span className="text-lg font-semibold text-foreground">{streak} day streak</span>
        </div>
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-neon-green" aria-hidden />
          <span className="text-lg font-semibold text-foreground">
            {overallMastery}% mastery
          </span>
        </div>
        <div className="ml-auto">
          {currentLessonId ? (
            <Link
              href="/learn"
              className="rounded-lg bg-cyber-cyan px-4 py-2 text-sm font-semibold text-background shadow-glow-cyan transition-opacity hover:opacity-90"
            >
              Continue
            </Link>
          ) : (
            <Link
              href="/learn"
              className="rounded-lg bg-cyber-cyan/15 px-4 py-2 text-sm font-semibold text-cyber-cyan transition-colors hover:bg-cyber-cyan/25"
            >
              Start Learning
            </Link>
          )}
        </div>
      </div>
      {currentLessonId && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Current lesson progress</span>
            <span>{currentProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              role="progressbar"
              aria-valuenow={currentProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${currentProgress}%` }}
              className="h-full rounded-full bg-cyber-cyan transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
}
