"use client";

import { useEffect, useState } from "react";
import { useLearningStore } from "@/stores/learningStore";
import { useQuizStore } from "@/stores/quizStore";
import QuizProgressBar from "@/components/quiz/QuizProgressBar";
import QuestionDisplay from "@/components/quiz/QuestionDisplay";
import AnswerOptions from "@/components/quiz/AnswerOptions";
import HintButton from "@/components/quiz/HintButton";
import QuizNavigation from "@/components/quiz/QuizNavigation";
import AITutorPanel from "@/components/tutor/AITutorPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function QuizWorkspace({
  coursesLoading = false,
  coursesError = null,
  onRetry,
}: {
  coursesLoading?: boolean;
  coursesError?: string | null;
  onRetry?: () => void;
}) {
  const activeLesson = useLearningStore((s) => s.activeLesson);
  const quiz = useQuizStore((s) => s.quiz);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const hintsUsed = useQuizStore((s) => s.hintsUsed);
  const score = useQuizStore((s) => s.score);
  const loadQuizForLesson = useQuizStore((s) => s.loadQuizForLesson);
  const setAnswer = useQuizStore((s) => s.setAnswer);
  const markHintUsed = useQuizStore((s) => s.useHint);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const setScore = useQuizStore((s) => s.setScore);

  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (activeLesson) loadQuizForLesson(activeLesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson?.id]);

  if (coursesError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-error">Couldn&apos;t load your course.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </main>
    );
  }

  if (coursesLoading) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-8">
        <Skeleton className="h-6 w-1/3 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </main>
    );
  }

  if (!activeLesson || quiz.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {activeLesson ? "This lesson has no practice questions yet." : "Select a lesson to practice."}
        </p>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col items-center gap-3 p-6">
        <p className="text-lg font-semibold text-foreground">Quiz complete!</p>
        <p className="text-sm text-muted-foreground">You scored {score}%.</p>
        <div className="mt-4 w-full max-w-2xl overflow-hidden rounded-xl border border-white/10">
          <AITutorPanel />
        </div>
      </main>
    );
  }

  const question = quiz[currentIndex];
  const isLast = currentIndex === quiz.length - 1;

  function handleNext() {
    if (!isLast) {
      nextQuestion();
      return;
    }

    const correctCount = quiz.filter((q) => answers[q.id] === q.correct_answer).length;
    const finalScore = Math.round((correctCount / quiz.length) * 100);
    setScore(finalScore);
    for (const q of quiz) {
      useLearningStore.getState().updateMastery(q.concept_id, answers[q.id] === q.correct_answer ? 1 : 0);
    }
    setSubmitted(true);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <QuizProgressBar current={currentIndex + 1} total={quiz.length} label={activeLesson.title} />
      <QuestionDisplay question={question} />
      <AnswerOptions
        options={question.options}
        selected={answers[question.id] ?? null}
        onSelect={(value) => setAnswer(question.id, value)}
      />
      <HintButton
        hint={question.hint}
        used={!!hintsUsed[question.id]}
        onUse={() => markHintUsed(question.id)}
      />
      <QuizNavigation
        canGoBack={currentIndex > 0}
        canGoNext={answers[question.id] !== undefined}
        isLast={isLast}
        onBack={() => useQuizStore.setState({ currentIndex: currentIndex - 1 })}
        onNext={handleNext}
      />
    </main>
  );
}
