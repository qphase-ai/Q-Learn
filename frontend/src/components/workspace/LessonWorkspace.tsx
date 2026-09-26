"use client";

import { Play, Wand2, Target } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import { useCircuitStore } from "@/stores/circuitStore";
import { useShellStore, type LessonTab } from "@/stores/shellStore";
import { useTutorStore } from "@/stores/tutorStore";
import { findModuleOfLesson } from "@/lib/progress";
import { nodesToCircuitSpec, specToQiskit } from "@/lib/circuit-spec";
import LessonContent from "@/components/learn/LessonContent";
import CircuitBuilderWorkspace from "@/components/circuit/CircuitBuilderWorkspace";
import CodePanel from "@/components/workspace/CodePanel";
import SimulationPanel from "@/components/workspace/SimulationPanel";
import PracticePanel from "@/components/workspace/PracticePanel";
import { Skeleton } from "@/components/ui/skeleton";

const TABS: { id: LessonTab; label: string }[] = [
  { id: "lesson", label: "Lesson" },
  { id: "circuit", label: "Circuit" },
  { id: "code", label: "Code" },
  { id: "simulation", label: "Simulation" },
  { id: "practice", label: "Practice" },
];

export default function LessonWorkspace() {
  const activeLesson = useLearningStore((s) => s.activeLesson);
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);

  const tab = useShellStore((s) => s.lessonTab);
  const setTab = useShellStore((s) => s.setLessonTab);
  const setTutorOpen = useShellStore((s) => s.setTutorOpen);
  const setTutorTab = useShellStore((s) => s.setTutorTab);

  const runSimulation = useCircuitStore((s) => s.runSimulation);
  const sendMessage = useTutorStore((s) => s.sendMessage);

  const moduleInfo = findModuleOfLesson(activeCourse, currentLessonId);
  const level = moduleInfo?.level;
  const lessonNo =
    moduleInfo && currentLessonId
      ? moduleInfo.module.lessons.findIndex((l) => l.id === currentLessonId) + 1
      : null;
  const label = level && lessonNo ? `${level}.${lessonNo}` : null;

  const runFromHeader = () => {
    setTab("simulation");
    void runSimulation();
  };

  const explainFromHeader = () => {
    setTutorTab("explain");
    setTutorOpen(true);
    const { nodes, qubitCount } = useCircuitStore.getState();
    const code = specToQiskit(nodesToCircuitSpec(nodes, qubitCount), "Student Circuit");
    void sendMessage(
      `Explain what this quantum circuit does, step by step, and the final state it produces. Use Dirac notation where helpful.\n\n\`\`\`python\n${code}\n\`\`\``
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Lesson header */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          {label && (
            <div className="text-[11px] font-medium uppercase tracking-wide text-cyber-cyan">
              Level {level} · {label}
            </div>
          )}
          {activeLesson ? (
            <h1 className="mt-0.5 truncate text-xl font-semibold text-foreground">
              {activeLesson.title}
            </h1>
          ) : (
            <Skeleton className="mt-1 h-6 w-64" />
          )}
          {activeLesson?.concepts && activeLesson.concepts.length > 0 && (
            <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
              {activeLesson.concepts.map((c) => c.name).join(" · ")}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <HeaderButton onClick={runFromHeader} icon={<Play size={14} />} label="Run Simulation" primary />
          <HeaderButton onClick={explainFromHeader} icon={<Wand2 size={14} />} label="Explain Circuit" />
          <HeaderButton onClick={() => setTab("practice")} icon={<Target size={14} />} label="Practice" />
        </div>
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Lesson workspace" className="flex gap-1 border-b border-border px-2 sm:px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2.5 text-[13px] font-medium transition-colors ${
              tab === t.id
                ? "text-cyber-cyan"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-cyber-cyan" aria-hidden />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "lesson" && (
          <div className="h-full overflow-y-auto">
            <LessonContent />
          </div>
        )}
        {tab === "circuit" && <CircuitBuilderWorkspace />}
        {tab === "code" && <CodePanel />}
        {tab === "simulation" && <SimulationPanel />}
        {tab === "practice" && <PracticePanel />}
      </div>
    </div>
  );
}

function HeaderButton({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        primary
          ? "bg-cyber-cyan text-background shadow-glow-cyan hover:brightness-110"
          : "border border-border/60 text-foreground hover:bg-elevated"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
