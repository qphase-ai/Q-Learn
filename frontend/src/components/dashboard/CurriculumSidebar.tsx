"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2, Lock, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useLearningStore } from "@/stores/learningStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  findModuleIndexForLesson,
  isLessonCompleted,
  isModuleCompleted,
  isModuleLocked,
  lessonLabel,
  levelLabel,
  moduleCompletion,
  sortedLessons,
  sortedModules,
} from "@/lib/curriculum";

export default function CurriculumSidebar({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);
  const loadLesson = useLearningStore((s) => s.loadLesson);
  const shouldReduceMotion = useReducedMotion();

  const modules = activeCourse ? sortedModules(activeCourse) : [];
  const activeModuleIndex = findModuleIndexForLesson(modules, currentLessonId);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(activeModuleIndex >= 0 ? [modules[activeModuleIndex].id] : [])
  );

  function toggleModule(index: number) {
    const targetModule = modules[index];
    if (isModuleLocked(modules, index, lessonProgress)) {
      toast(`Complete ${levelLabel(index)} to unlock ${levelLabel(index + 1)}`);
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(targetModule.id)) next.delete(targetModule.id);
      else next.add(targetModule.id);
      return next;
    });
  }

  return (
    <aside
      className="flex w-[250px] flex-shrink-0 flex-col overflow-y-auto border-r border-overlay/10 bg-surface"
      aria-label="Quantum curriculum"
    >
      <div className="border-b border-overlay/10 p-4">
        <h2 className="text-sm font-semibold text-foreground">Quantum Curriculum</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {modules.length > 0
            ? `${modules.length} levels • From basics to Shor's algorithm`
            : "Loading curriculum…"}
        </p>
      </div>

      <div className="flex-1 p-2">
        {error && (
          <div className="flex flex-col gap-2 p-3 text-center">
            <p className="text-xs text-error">Couldn&apos;t load curriculum.</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {!error && loading && (
          <div className="flex flex-col gap-2 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!error &&
          !loading &&
          modules.map((mod, index) => {
            const isActive = index === activeModuleIndex;
            const completed = isModuleCompleted(mod, lessonProgress);
            const locked = isModuleLocked(modules, index, lessonProgress);
            const isOpen = expanded.has(mod.id) && !locked;
            const { done, total } = moduleCompletion(mod, lessonProgress);

            return (
              <div key={mod.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleModule(index)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "border-l-2 border-electric-purple bg-electric-purple/10 pl-[6px] text-foreground"
                      : locked
                        ? "text-muted-foreground opacity-60"
                        : "text-foreground hover:bg-overlay/5"
                  }`}
                >
                  {locked ? (
                    <Lock size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                  ) : completed ? (
                    <CheckCircle2 size={15} className="shrink-0 text-success" aria-hidden />
                  ) : (
                    <span className="h-[15px] w-[15px] shrink-0 rounded-full border border-overlay/20" />
                  )}
                  <span className="flex-1 truncate">
                    <span className="block truncate font-medium">{levelLabel(index)}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {mod.title}
                    </span>
                  </span>
                  {isActive && (
                    <span className="shrink-0 rounded-full bg-electric-purple/15 px-1.5 py-0.5 text-[10px] font-medium text-electric-purple">
                      {done}/{total}
                    </span>
                  )}
                  {!locked && (
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                      animate={shouldReduceMotion ? undefined : { height: "auto", opacity: 1 }}
                      exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden pl-[27px]"
                    >
                      {sortedLessons(mod).map((lesson, lessonIndex) => {
                        const lessonDone = isLessonCompleted(lessonProgress, lesson.id);
                        const isSelected = lesson.id === currentLessonId;
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => void loadLesson(lesson.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                              isSelected
                                ? "bg-cyber-cyan/10 text-cyber-cyan"
                                : "text-muted-foreground hover:bg-overlay/5 hover:text-foreground"
                            }`}
                          >
                            {lessonDone ? (
                              <CheckCircle2 size={12} className="shrink-0 text-success" aria-hidden />
                            ) : (
                              <span className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">
                              {lessonLabel(index, lessonIndex, lesson.title)}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

        {!error && !loading && modules.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">No courses available yet.</p>
        )}
      </div>
    </aside>
  );
}
