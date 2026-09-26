"use client";

import LabShell from "@/components/dashboard/LabShell";
import QuizWorkspace from "@/components/quiz/QuizWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";

export default function QuizPage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  return (
    <LabShell
      sidebarCollapsed
      tutorCollapsed
      activityBarDim
      sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}
    >
      {() => <QuizWorkspace />}
    </LabShell>
  );
}
