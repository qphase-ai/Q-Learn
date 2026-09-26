"use client";

import { useState } from "react";
import { useTutorStore } from "@/stores/tutorStore";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardActivityBar from "@/components/dashboard/DashboardActivityBar";
import CurriculumSidebar from "@/components/dashboard/CurriculumSidebar";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import DashboardTutorPanel, {
  type AskableTab,
  type TutorTab,
} from "@/components/dashboard/DashboardTutorPanel";

const CANNED_PROMPTS: Record<AskableTab, string> = {
  explain: "Explain my circuit",
  hints: "Give me a hint for this lesson",
  next: "What should I try next?",
};

export default function DashboardWorkspace() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();

  const [activeTutorTab, setActiveTutorTab] = useState<TutorTab>("chat");
  const [askedTutorTabs, setAskedTutorTabs] = useState<Set<AskableTab>>(new Set());
  const [tutorAskError, setTutorAskError] = useState<string | null>(null);

  function askTutor(tab: AskableTab) {
    setActiveTutorTab(tab);
    if (askedTutorTabs.has(tab)) return;
    setTutorAskError(null);
    useTutorStore
      .getState()
      .sendMessage(CANNED_PROMPTS[tab])
      .then(() => {
        setAskedTutorTabs((prev) => new Set(prev).add(tab));
      })
      .catch((err) => {
        setTutorAskError(err instanceof Error ? err.message : "Couldn't reach the tutor — try again.");
      });
  }

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardActivityBar onOpenTutor={() => setActiveTutorTab("chat")} />
        <CurriculumSidebar
          loading={coursesLoading}
          error={coursesError}
          onRetry={onRetry}
        />
        <CentralWorkspace onExplainCircuit={() => askTutor("explain")} />
        <DashboardTutorPanel
          activeTab={activeTutorTab}
          onTabChange={setActiveTutorTab}
          askedTabs={askedTutorTabs}
          onAsk={askTutor}
          askError={tutorAskError}
        />
      </div>
    </div>
  );
}
