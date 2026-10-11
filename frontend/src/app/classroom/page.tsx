"use client";

import LabShell from "@/components/dashboard/LabShell";
import ClassroomWorkspace from "@/components/classroom/ClassroomWorkspace";

const NO_SIDEBAR = { loading: false, error: null, onRetry: () => {} };

export default function ClassroomPage() {
  return (
    <LabShell sidebarCollapsed tutorCollapsed sidebarProps={NO_SIDEBAR}>
      {() => <ClassroomWorkspace />}
    </LabShell>
  );
}
