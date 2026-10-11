"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import LabShell from "@/components/dashboard/LabShell";
import CentralWorkspace from "@/components/dashboard/CentralWorkspace";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";
import { hasStashedCircuit, takeStashedCircuit } from "@/lib/circuit-handoff";
import { useCircuitStore } from "@/stores/circuitStore";

export default function CircuitPage() {
  const { coursesLoading, coursesError, onRetry } = useCourseBootstrap();
  const loadFromSpec = useCircuitStore((s) => s.loadFromSpec);
  const loaded = useRef(false);
  // A circuit the AI Classroom whiteboard handed off isn't tied to any
  // lesson, so the builder opens as a standalone sandbox instead of asking
  // the student to pick a lesson first. Computed lazily (not in the effect
  // below) so the first render already knows, avoiding a "select a lesson"
  // flash before the handoff is consumed.
  const [standaloneSandbox, setStandaloneSandbox] = useState(
    () => typeof window !== "undefined" && hasStashedCircuit()
  );

  // One-shot: runs once per mount so a later in-page circuit edit (e.g.
  // undo) is never overwritten by a stale handoff on re-render.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const handoff = takeStashedCircuit();
    if (!handoff) return;
    setStandaloneSandbox(true);
    loadFromSpec(handoff, handoff.name || "From AI Classroom");
    toast.success("Circuit loaded from AI Classroom — press Run to simulate it.");
  }, [loadFromSpec]);

  return (
    <LabShell sidebarProps={{ loading: coursesLoading, error: coursesError, onRetry }}>
      {({ onExplainCircuit }) => (
        <CentralWorkspace
          onExplainCircuit={onExplainCircuit}
          lockedTab="circuit"
          standaloneSandbox={standaloneSandbox}
        />
      )}
    </LabShell>
  );
}
