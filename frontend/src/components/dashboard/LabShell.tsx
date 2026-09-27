"use client";

import { useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardActivityBar from "@/components/dashboard/DashboardActivityBar";
import CurriculumSidebar from "@/components/dashboard/CurriculumSidebar";
import DashboardTutorPanel, {
  type AskableTab,
  type TutorTab,
} from "@/components/dashboard/DashboardTutorPanel";
import AuthHydrator from "@/components/shell/AuthHydrator";
import { useTutorStore } from "@/stores/tutorStore";
import { useCircuitStore } from "@/stores/circuitStore";
import { nodesToCircuitSpec, circuitSpecToQiskitSource } from "@/lib/circuit-spec";

const CANNED_PROMPTS: Record<AskableTab, string> = {
  explain: "Explain my circuit",
  hints: "Give me a hint for this lesson",
  next: "What should I try next?",
};

export interface LabShellSidebarProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export interface LabShellChildContext {
  onExplainCircuit: () => void;
}

export default function LabShell({
  sidebarCollapsed = false,
  tutorCollapsed = false,
  activityBarDim = false,
  sidebarProps,
  children,
}: {
  sidebarCollapsed?: boolean;
  tutorCollapsed?: boolean;
  activityBarDim?: boolean;
  sidebarProps: LabShellSidebarProps;
  children: (ctx: LabShellChildContext) => React.ReactNode;
}) {
  const [activeTutorTab, setActiveTutorTab] = useState<TutorTab>("chat");
  const [askedTutorTabs, setAskedTutorTabs] = useState<Set<AskableTab>>(new Set());
  const [tutorAskError, setTutorAskError] = useState<string | null>(null);

  function askTutor(tab: AskableTab) {
    setActiveTutorTab(tab);
    setTutorAskError(null);

    let circuitContext: string | undefined;
    if (tab === "explain") {
      const { nodes, qubitCount, results } = useCircuitStore.getState();
      const spec = nodesToCircuitSpec(nodes, qubitCount);
      let source = circuitSpecToQiskitSource(spec);
      if (results?.probabilities) {
        const probs = Object.entries(results.probabilities)
          .map(([state, p]) => `  ${state}: ${(p * 100).toFixed(1)}%`)
          .join("\n");
        source += `\n\n# Last simulation results (probabilities):\n${probs}`;
      }
      circuitContext = source;
    }

    useTutorStore
      .getState()
      .sendMessage(CANNED_PROMPTS[tab], circuitContext)
      .then(() => {
        setAskedTutorTabs((prev) => new Set(prev).add(tab));
      })
      .catch((err) => {
        setTutorAskError(err instanceof Error ? err.message : "Couldn't reach the tutor — try again.");
      });
  }

  return (
    <div className="flex h-screen flex-col">
      <AuthHydrator />
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardActivityBar
          onOpenTutor={() => setActiveTutorTab("chat")}
          dim={activityBarDim}
        />
        {!sidebarCollapsed && (
          <CurriculumSidebar
            loading={sidebarProps.loading}
            error={sidebarProps.error}
            onRetry={sidebarProps.onRetry}
          />
        )}
        {children({ onExplainCircuit: () => askTutor("explain") })}
        {!tutorCollapsed && (
          <DashboardTutorPanel
            activeTab={activeTutorTab}
            onTabChange={setActiveTutorTab}
            askedTabs={askedTutorTabs}
            onAsk={askTutor}
            askError={tutorAskError}
          />
        )}
      </div>
    </div>
  );
}
