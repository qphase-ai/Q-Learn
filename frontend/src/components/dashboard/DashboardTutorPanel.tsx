"use client";

import { Sparkles, Lightbulb, Target, RefreshCw } from "lucide-react";
import { useTutorStore } from "@/stores/tutorStore";
import AITutorPanel from "@/components/tutor/AITutorPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TutorTab = "chat" | "explain" | "hints" | "next";
export type AskableTab = Exclude<TutorTab, "chat">;

const TAB_META: Record<AskableTab, { title: string; description: string; cta: string; icon: typeof Sparkles }> = {
  explain: {
    title: "Explain My Circuit",
    description: "Get a detailed explanation of what your current circuit does.",
    cta: "Explain this circuit",
    icon: Sparkles,
  },
  hints: {
    title: "Stuck? Get a Hint",
    description: "Ask the tutor for a nudge in the right direction.",
    cta: "Give me a hint",
    icon: Lightbulb,
  },
  next: {
    title: "Next Step Recommendation",
    description: "See a suggested next challenge based on your current circuit.",
    cta: "What should I try next?",
    icon: Target,
  },
};

export default function DashboardTutorPanel({
  activeTab,
  onTabChange,
  askedTabs,
  onAsk,
  askError,
}: {
  activeTab: TutorTab;
  onTabChange: (tab: TutorTab) => void;
  askedTabs: Set<AskableTab>;
  onAsk: (tab: AskableTab) => void;
  askError: string | null;
}) {
  const isStreaming = useTutorStore((s) => s.isStreaming);

  return (
    <aside
      className="flex w-[340px] flex-shrink-0 flex-col border-l border-white/10 bg-surface"
      aria-label="AI Tutor"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">AI Tutor</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
          Online
        </span>
      </div>

      <div className="border-b border-white/10 p-2">
        <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as TutorTab)}>
          <TabsList className="w-full justify-between">
            <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
            <TabsTrigger value="explain" className="flex-1">Explain</TabsTrigger>
            <TabsTrigger value="hints" className="flex-1">Hints</TabsTrigger>
            <TabsTrigger value="next" className="flex-1">Next Steps</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === "chat" ? (
          <AITutorPanel />
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="overflow-y-auto p-3">
              <AskableHeroCard
                tab={activeTab}
                asked={askedTabs.has(activeTab)}
                isStreaming={isStreaming}
                onAsk={() => onAsk(activeTab)}
              />
              {askError && (
                <p className="mt-2 text-xs text-error">{askError}</p>
              )}
            </div>
            {askedTabs.has(activeTab) && (
              <div className="flex-1 overflow-hidden border-t border-white/10">
                <AITutorPanel />
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function AskableHeroCard({
  tab,
  asked,
  isStreaming,
  onAsk,
}: {
  tab: AskableTab;
  asked: boolean;
  isStreaming: boolean;
  onAsk: () => void;
}) {
  const meta = TAB_META[tab];
  const Icon = meta.icon;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-electric-purple/15 text-electric-purple">
          <Icon size={16} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{meta.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3 w-full"
        disabled={isStreaming}
        onClick={onAsk}
      >
        {asked ? <RefreshCw size={14} aria-hidden /> : <Sparkles size={14} aria-hidden />}
        {asked ? "Ask again" : meta.cta}
      </Button>
    </div>
  );
}
