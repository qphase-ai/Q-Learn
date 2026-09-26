"use client";

import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";
import LabShell from "@/components/dashboard/LabShell";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";

export default function DashboardWorkspace() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  return (
    <LabShell
      sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}
    >
      {({ onExplainCircuit }) => <CentralWorkspace onExplainCircuit={onExplainCircuit} />}
    </LabShell>
  );
}
