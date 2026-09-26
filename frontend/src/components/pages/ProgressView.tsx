"use client";

import { BarChart3, Flame, Trophy, GraduationCap, CheckCircle2, Circle } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";
import {
  sortedModules,
  moduleCompletion,
  isModuleCompleted,
  levelLabel,
} from "@/lib/curriculum";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProgressView() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const masteryScores = useLearningStore((s) => s.masteryScores);
  const xp = useLearningStore((s) => s.xp);
  const streak = useLearningStore((s) => s.streak);

  const modules = activeCourse ? sortedModules(activeCourse) : [];
  const allLessons = modules.flatMap((m) => m.lessons);
  const completedLessons = allLessons.filter((l) => (lessonProgress[l.id] ?? 0) >= 100).length;
  const overallPct =
    allLessons.length > 0 ? Math.round((completedLessons / allLessons.length) * 100) : 0;
  const levelsDone = modules.filter((m) => isModuleCompleted(m, lessonProgress)).length;
  const mastery = Object.entries(masteryScores);

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-purple/15 text-electric-purple">
          <BarChart3 size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Your Progress</h1>
          <p className="text-sm text-muted-foreground">
            Track completion, mastery, and momentum across the curriculum.
          </p>
        </div>
      </header>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Trophy size={18} />} label="Overall completion" value={`${overallPct}%`} accent="cyber-cyan" />
        <StatTile icon={<GraduationCap size={18} />} label="Levels completed" value={`${levelsDone}/${modules.length || 0}`} accent="electric-purple" />
        <StatTile icon={<CheckCircle2 size={18} />} label="Lessons completed" value={`${completedLessons}/${allLessons.length || 0}`} accent="neon-green" />
        <StatTile icon={<Flame size={18} />} label="Day streak" value={`${streak}`} sub={`${xp} XP earned`} accent="warning" />
      </div>

      {/* Level progress */}
      <section className="rounded-xl border border-white/10 bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Level progress</h2>

        {coursesError ? (
          <div className="flex flex-col items-start gap-2 text-sm text-error">
            <span>Couldn&apos;t load your curriculum progress.</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-white/10 px-3 py-1 text-xs text-foreground hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        ) : coursesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No curriculum available yet.</p>
        ) : (
          <ul className="space-y-4">
            {modules.map((mod, idx) => {
              const { done, total } = moduleCompletion(mod, lessonProgress);
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const complete = isModuleCompleted(mod, lessonProgress);
              return (
                <li key={mod.id} className="flex items-center gap-3">
                  <span className="flex-shrink-0">
                    {complete ? (
                      <CheckCircle2 size={16} className="text-success" aria-hidden />
                    ) : (
                      <Circle size={16} className="text-muted-foreground/40" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate text-foreground">
                        <span className="text-muted-foreground">{levelLabel(idx)} · </span>
                        {mod.title}
                      </span>
                      <span className="flex-shrink-0 text-muted-foreground">
                        {done}/{total}
                      </span>
                    </div>
                    <Progress value={pct} className="[&>*]:bg-electric-purple" aria-label={`${levelLabel(idx)} progress`} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Concept mastery */}
      <section className="rounded-xl border border-white/10 bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Concept mastery</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Bayesian knowledge-tracing estimates updated as you learn.
        </p>
        {mastery.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Complete lessons and quizzes to build your mastery profile.
          </p>
        ) : (
          <ul className="space-y-3">
            {mastery.map(([concept, score]) => {
              const pct = Math.round(score * 100);
              return (
                <li key={concept} className="flex items-center gap-3">
                  <span className="w-40 flex-shrink-0 truncate text-[13px] capitalize text-foreground">
                    {concept}
                  </span>
                  <Progress value={pct} className="[&>*]:bg-cyber-cyan" aria-label={`${concept} mastery`} />
                  <span className="w-10 flex-shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: "cyber-cyan" | "electric-purple" | "neon-green" | "warning";
}) {
  const accentClass = {
    "cyber-cyan": "text-cyber-cyan",
    "electric-purple": "text-electric-purple",
    "neon-green": "text-neon-green",
    warning: "text-warning",
  }[accent];
  return (
    <div className="rounded-xl border border-white/10 bg-surface p-4">
      <div className={`mb-2 flex items-center gap-2 ${accentClass}`}>
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
