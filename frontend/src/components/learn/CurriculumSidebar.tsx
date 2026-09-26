"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Check, Lock, Circle } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import { useAuthStore } from "@/stores/authStore";
import { moduleProgressPct } from "@/lib/progress";
import type { LessonSummary, ModuleWithLessons } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function CurriculumSidebar() {
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const courses = useLearningStore((s) => s.courses);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadCourse = useLearningStore((s) => s.loadCourse);
  const loadLesson = useLearningStore((s) => s.loadLesson);
  const role = useAuthStore((s) => s.user?.role);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand the module that holds the active lesson.
  useEffect(() => {
    if (!activeCourse || !currentLessonId) return;
    const mod = activeCourse.modules.find((m) =>
      m.lessons.some((l) => l.id === currentLessonId)
    );
    if (mod) setExpanded((e) => ({ ...e, [mod.id]: true }));
  }, [activeCourse, currentLessonId]);

  if (!activeCourse) {
    return (
      <aside className="hidden w-[264px] flex-shrink-0 flex-col gap-3 overflow-y-auto border-r border-border p-3 md:flex">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </aside>
    );
  }

  const isFree = !role || role === "student";
  const totalLevels = activeCourse.modules.length;

  return (
    <aside className="hidden w-[264px] flex-shrink-0 flex-col overflow-y-auto border-r border-border md:flex">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="text-sm font-semibold text-foreground">Quantum Curriculum</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {totalLevels} levels · {activeCourse.difficulty}
        </div>
        {courses.length > 1 && (
          <select
            value={activeCourse.id}
            onChange={(e) => loadCourse(e.target.value)}
            aria-label="Select course"
            className="mt-2 w-full rounded-md border border-border/60 bg-elevated px-2 py-1 text-xs text-foreground outline-none"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Levels */}
      <div className="flex-1 py-1">
        {activeCourse.modules.map((mod, idx) => (
          <LevelGroup
            key={mod.id}
            module={mod}
            level={idx + 1}
            open={expanded[mod.id] ?? false}
            onToggle={() => setExpanded((e) => ({ ...e, [mod.id]: !e[mod.id] }))}
            pct={moduleProgressPct(mod, lessonProgress)}
            currentLessonId={currentLessonId}
            lessonProgress={lessonProgress}
            isFree={isFree}
            onSelectLesson={(id) => loadLesson(id)}
          />
        ))}
      </div>
    </aside>
  );
}

function LevelGroup({
  module,
  level,
  open,
  onToggle,
  pct,
  currentLessonId,
  lessonProgress,
  isFree,
  onSelectLesson,
}: {
  module: ModuleWithLessons;
  level: number;
  open: boolean;
  onToggle: () => void;
  pct: number;
  currentLessonId: string | null;
  lessonProgress: Record<string, number>;
  isFree: boolean;
  onSelectLesson: (id: string) => void;
}) {
  const completed = module.lessons.filter((l) => (lessonProgress[l.id] ?? 0) >= 100).length;
  const total = module.lessons.length;
  const done = pct >= 100;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-elevated/60"
      >
        {open ? (
          <ChevronDown size={14} className="flex-shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="flex-1">
          <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
            Level {level}
          </span>
          <span className="block text-[13px] font-medium leading-tight text-foreground">
            {module.title}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            {completed}/{total}
          </span>
          {done ? (
            <Check size={15} className="text-success" aria-label="completed" />
          ) : (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: pct > 0 ? "hsl(var(--cyber-cyan))" : "hsl(var(--elevated))",
              }}
              aria-hidden
            />
          )}
        </span>
      </button>

      {open && (
        <ul className="pb-1">
          {module.lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              level={level}
              lesson={lesson}
              active={lesson.id === currentLessonId}
              completed={(lessonProgress[lesson.id] ?? 0) >= 100}
              locked={isFree && lesson.is_pro}
              onSelect={() => onSelectLesson(lesson.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LessonRow({
  level,
  lesson,
  active,
  completed,
  locked,
  onSelect,
}: {
  level: number;
  lesson: LessonSummary;
  active: boolean;
  completed: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        data-active={active ? "true" : "false"}
        className={`flex w-full items-center gap-2 border-l-2 py-1.5 pl-8 pr-3 text-left text-[13px] leading-snug outline-none transition-colors ${
          active
            ? "border-cyber-cyan bg-cyber-cyan/5 text-cyber-cyan"
            : "border-transparent text-foreground hover:bg-elevated/50"
        }`}
      >
        <span className="flex-1">
          <span className="mr-1 text-muted-foreground">
            {level}.{lesson.order_index + 1}
          </span>
          {lesson.title}
        </span>
        {locked ? (
          <Lock size={13} className="flex-shrink-0 text-muted-foreground" aria-label="pro lesson" />
        ) : completed ? (
          <Check size={14} className="flex-shrink-0 text-success" aria-label="completed" />
        ) : (
          <Circle size={13} className="flex-shrink-0 text-muted-foreground/40" aria-hidden />
        )}
      </button>
    </li>
  );
}
