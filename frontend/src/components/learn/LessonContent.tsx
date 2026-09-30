"use client";

import Markdown from "@/components/learn/Markdown";
import LessonBlocks from "@/components/learn/blocks";
import { isTrackableLessonId } from "@/lib/content-source";
import { useLearningStore } from "@/stores/learningStore";
import { Button } from "@/components/ui/button";

export default function LessonContent() {
  const activeLesson = useLearningStore((s) => s.activeLesson);
  const lessonProgress = useLearningStore((s) => s.lessonProgress);

  const hasBlocks = Boolean(activeLesson?.blocks?.length);
  if (!activeLesson || (!hasBlocks && !activeLesson.content)) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Select a lesson to begin.
      </div>
    );
  }

  const isCompleted = (lessonProgress[activeLesson.id] ?? 0) >= 100;

  return (
    <article
      className="mx-auto w-full max-w-[720px] p-6 font-sans leading-[1.7] text-foreground"
    >
      {hasBlocks ? (
        <LessonBlocks blocks={activeLesson.blocks!} />
      ) : (
        <Markdown>{activeLesson.content ?? ""}</Markdown>
      )}

      <footer className="mt-8 flex justify-end border-t border-border pt-4">
        {!isTrackableLessonId(activeLesson.id) ? (
          <span className="text-xs text-muted-foreground">Progress tracking unavailable for this lesson</span>
        ) : isCompleted ? (
          <span className="text-sm font-semibold text-success">✓ Completed</span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              useLearningStore.getState().markProgress(activeLesson.id, 100)
            }
          >
            Mark complete
          </Button>
        )}
      </footer>
    </article>
  );
}
