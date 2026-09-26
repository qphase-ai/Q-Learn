"use client";

import { useState } from "react";
import { Play, Sparkles, ListChecks } from "lucide-react";
import Link from "next/link";
import { useLearningStore } from "@/stores/learningStore";
import { useCircuitStore } from "@/stores/circuitStore";
import {
  findModuleIndexForLesson,
  firstSentence,
  lessonLabel,
  levelLabel,
  sortedLessons,
  sortedModules,
} from "@/lib/curriculum";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LessonContent from "@/components/learn/LessonContent";
import ConceptCard from "@/components/dashboard/ConceptCard";
import GatePalette from "@/components/circuit/GatePalette";
import CircuitCanvas from "@/components/circuit/CircuitCanvas";
import CircuitToolbar from "@/components/circuit/CircuitToolbar";
import CircuitCodePanel from "@/components/dashboard/CircuitCodePanel";
import ProbabilityChart from "@/components/visualization/ProbabilityChart";
import StateVectorTable from "@/components/visualization/StateVectorTable";
import StateSphereVisualization from "@/components/dashboard/StateSphereVisualization";

type CentralTab = "lesson" | "circuit" | "code" | "simulation" | "practice";

function keyInsight(probabilities: Record<string, number> | null | undefined): string | null {
  if (!probabilities) return null;
  const entries = Object.entries(probabilities)
    .filter(([, p]) => p > 0.01)
    .sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    return `The circuit deterministically produces |${entries[0][0]}⟩.`;
  }
  const [first, second] = entries;
  return `The most likely outcomes are |${first[0]}⟩ (${Math.round(first[1] * 100)}%) and |${second[0]}⟩ (${Math.round(second[1] * 100)}%).`;
}

export default function CentralWorkspace({
  onExplainCircuit,
  lockedTab,
  showTabBar = lockedTab === undefined,
}: {
  onExplainCircuit: () => void;
  lockedTab?: CentralTab;
  showTabBar?: boolean;
}) {
  const activeCourse = useLearningStore((s) => s.activeCourse);
  const activeLesson = useLearningStore((s) => s.activeLesson);
  const currentLessonId = useLearningStore((s) => s.currentLessonId);

  const runSimulation = useCircuitStore((s) => s.runSimulation);
  const runState = useCircuitStore((s) => s.runState);
  const error = useCircuitStore((s) => s.error);
  const results = useCircuitStore((s) => s.results);

  const [internalTab, setInternalTab] = useState<CentralTab>("lesson");
  const tab = lockedTab ?? internalTab;
  const setTab = setInternalTab;

  const modules = activeCourse ? sortedModules(activeCourse) : [];
  const moduleIndex = findModuleIndexForLesson(modules, currentLessonId);
  const activeModule = moduleIndex >= 0 ? modules[moduleIndex] : null;
  const lessonIndex = activeModule
    ? sortedLessons(activeModule).findIndex((l) => l.id === currentLessonId)
    : -1;

  const breadcrumb =
    activeModule && lessonIndex >= 0
      ? `${levelLabel(moduleIndex)} › ${lessonLabel(moduleIndex, lessonIndex, activeLesson?.title ?? "")}`
      : null;

  const summary = firstSentence(activeLesson?.content);

  async function handleRunSimulation() {
    setTab("simulation");
    await runSimulation();
  }

  if (!activeLesson) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 overflow-auto p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Select a lesson from the curriculum to begin
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Pick any unlocked level in the sidebar to open its lesson, circuit, and simulation
          workspace here.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-auto p-4">
      <div className="flex flex-wrap items-center gap-3">
        {breadcrumb && (
          <span className="text-xs text-muted-foreground">{breadcrumb}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" size="sm" onClick={handleRunSimulation} disabled={runState === "running"}>
            <Play size={14} aria-hidden />
            {runState === "running" ? "Running…" : "Run Simulation"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onExplainCircuit}>
            <Sparkles size={14} aria-hidden />
            Explain Circuit
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setTab("practice")}>
            <ListChecks size={14} aria-hidden />
            Practice
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-foreground">{activeLesson.title}</h1>
        {summary && <p className="mt-1 text-sm text-muted-foreground">{summary}</p>}
      </div>

      {showTabBar && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as CentralTab)}>
          <TabsList>
            <TabsTrigger value="lesson">Lesson</TabsTrigger>
            <TabsTrigger value="circuit">Circuit</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="simulation">Simulation</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {tab === "lesson" && (
        <div className="flex flex-col gap-4">
          {activeLesson.concepts.map((concept) => (
            <ConceptCard key={concept.id} concept={concept} />
          ))}
          <LessonContent />
        </div>
      )}

      {/* The embedded circuit tab intentionally shares the same live
          `circuitStore` as the standalone `/circuit` workspace — editing the
          circuit here is the same circuit reachable from "Open in Circuit
          Builder" on the Learn workspace, not a separate per-lesson copy. */}
      {tab === "circuit" && (
        <div
          className={`flex overflow-hidden rounded-xl border border-white/10 ${
            lockedTab ? "flex-1" : "h-[420px]"
          }`}
        >
          <GatePalette />
          <div className="flex flex-1 flex-col">
            <CircuitToolbar />
            <div className="flex-1">
              <CircuitCanvas />
            </div>
          </div>
        </div>
      )}

      {tab === "code" && (
        <div className={lockedTab ? "flex-1" : "h-[420px]"}>
          <CircuitCodePanel />
        </div>
      )}

      {tab === "simulation" && (
        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Simulation Results</span>
            {results && (
              <span
                className={`text-xs ${runState === "error" ? "text-error" : "text-success"}`}
              >
                {runState === "error" ? "● Simulation failed" : "● Simulation completed"}
              </span>
            )}
          </div>

          {runState === "error" && (
            <p className="rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error">
              {error ?? "The simulation failed to run."}
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Measurement Probabilities
                </p>
                <ProbabilityChart />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">State Vector</p>
                <StateVectorTable />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Quantum State Visualization
              </p>
              <StateSphereVisualization />
              {keyInsight(results?.probabilities) && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                  <span className="font-medium text-warning">Key Insight: </span>
                  {keyInsight(results?.probabilities)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "practice" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-surface p-8 text-center">
          <p className="text-sm font-medium text-foreground">Practice problems for this lesson</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Head to the Quiz workspace to test what you&apos;ve learned in this level.
          </p>
          <Button asChild size="sm">
            <Link href="/quiz">Open Practice</Link>
          </Button>
        </div>
      )}
    </main>
  );
}
