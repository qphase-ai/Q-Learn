"use client";

import LabShell from "@/components/dashboard/LabShell";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";

export default function CodePage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  return (
    <LabShell sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}>
      {({ onExplainCircuit }) => (
        <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="code" />
      )}
    </LabShell>
  );
}
