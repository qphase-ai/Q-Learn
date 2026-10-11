"use client";

import LabShell from "@/components/dashboard/LabShell";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";

export default function CircuitPage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  // A circuit handed off from the AI Classroom is consumed by CentralWorkspace
  // (useCircuitHandoff), which also decides standalone-sandbox mode.
  return (
    <LabShell sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}>
      {({ onExplainCircuit }) => (
        <CentralWorkspace onExplainCircuit={onExplainCircuit} lockedTab="circuit" />
      )}
    </LabShell>
  );
}
