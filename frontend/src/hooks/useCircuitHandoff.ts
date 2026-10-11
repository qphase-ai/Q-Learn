"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { takeStashedCircuit } from "@/lib/circuit-handoff";
import { useCircuitStore } from "@/stores/circuitStore";

/**
 * Consume a circuit the AI Classroom whiteboard handed off (one-shot, on
 * mount) and load it into the circuit store. Such a circuit isn't tied to any
 * lesson, so `standalone` tells the workspace to open as a sandbox.
 *
 * `standalone` starts false and is only set after mount (never read from
 * storage during render) so server and first client render agree; `checked`
 * flips true once the handoff has been looked for, so callers can show a
 * neutral placeholder instead of flashing "select a lesson".
 */
export function useCircuitHandoff(enabled: boolean): { standalone: boolean; checked: boolean } {
  const loadFromSpec = useCircuitStore((s) => s.loadFromSpec);
  const [state, setState] = useState({ standalone: false, checked: false });
  const consumed = useRef(false);

  // One-shot: a later in-page edit (e.g. undo) must never be overwritten by a
  // stale handoff on re-render.
  useEffect(() => {
    if (!enabled || consumed.current) return;
    consumed.current = true;
    const handoff = takeStashedCircuit();
    if (handoff) {
      loadFromSpec(handoff, handoff.name || "From AI Classroom");
      toast.success("Circuit loaded from AI Classroom — press Run to simulate it.");
    }
    setState({ standalone: handoff !== null, checked: true });
  }, [enabled, loadFromSpec]);

  return state;
}
