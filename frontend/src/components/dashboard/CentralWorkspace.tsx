"use client";

import { useState } from "react";
import { Play, Sparkles, ListChecks } from "lucide-react";
import Link from "next/link";
import { useLearningStore } from "@/stores/learningStore";
import { useCircuitStore } from "@/stores/circuitStore";
import { useCircuitShortcuts } from "@/hooks/useCircuitShortcuts";
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
import FileTreePanel from "@/components/dashboard/FileTreePanel";
import MonacoCodePanel from "@/components/dashboard/MonacoCodePanel";
import CircuitResultsPanel from "@/components/dashboard/CircuitResultsPanel";

type CentralTab = "lesson" | "circuit" | "code" | "simulation" | "practice";

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

  const [internalTab, setInternalTab] = useState<CentralTab>("lesson");
  const tab = lockedTab ?? internalTab;
  const setTab = setInternalTab;

  // Only active on the standalone /circuit route (`lockedTab === "circuit"`)
  // — not when the circuit tab is just one of several visible in the
  // embedded dashboard preview, where a global Space/Delete shortcut would
  // be surprising.
  useCircuitShortcuts(lockedTab === "circuit");

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
          {lockedTab !== "code" && (
            <Button type="button" size="sm" onClick={handleRunSimulation} disabled={runState === "running"}>
              <Play size={14} aria-hidden />
              {runState === "running" ? "Running…" : "Run Simulation"}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={onExplainCircuit}>
            <Sparkles size={14} aria-hidden />
            Explain Circuit
          </Button>
          {lockedTab ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/quiz">
                <ListChecks size={14} aria-hidden />
                Practice
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setTab("practice")}>
              <ListChecks size={14} aria-hidden />
              Practice
            </Button>
          )}
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
          {lockedTab === "lesson" && runState !== "idle" && <CircuitResultsPanel />}
        </div>
      )}

      {/* The embedded circuit tab intentionally shares the same live
          `circuitStore` as the standalone `/circuit` workspace — editing the
          circuit here is the same circuit reachable from "Open in Circuit
          Builder" on the Learn workspace, not a separate per-lesson copy. */}
      {tab === "circuit" && (
        <div className={`flex flex-col gap-4 ${lockedTab ? "flex-1 overflow-y-auto" : ""}`}>
          <div
            className={`flex overflow-hidden rounded-xl border border-white/10 ${
              lockedTab ? "h-[420px] flex-shrink-0" : "h-[420px]"
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
          {lockedTab === "circuit" && runState !== "idle" && <CircuitResultsPanel />}
        </div>
      )}

      {tab === "code" && (
        <div className={`flex flex-col gap-4 ${lockedTab ? "flex-1 overflow-y-auto" : ""}`}>
          <div
            className={`flex overflow-hidden rounded-xl ${
              lockedTab ? "h-[420px] flex-shrink-0" : "h-[420px] border border-white/10"
            }`}
          >
            {lockedTab && <FileTreePanel activeFile="circuit.py" />}
            <div className="flex-1">
              <MonacoCodePanel />
            </div>
          </div>
          {lockedTab === "code" && runState !== "idle" && <CircuitResultsPanel />}
        </div>
      )}

      {tab === "simulation" && <CircuitResultsPanel />}

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
