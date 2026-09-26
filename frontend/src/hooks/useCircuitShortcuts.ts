"use client";

import { useEffect } from "react";
import { useCircuitStore } from "@/stores/circuitStore";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

/**
 * Wires Space/Delete/H/X/C/M shortcuts for the circuit canvas. Pass
 * `enabled: false` to mount the listener without activating it — callers
 * pass `enabled: true` only when `lockedTab === "circuit"` (i.e. on the
 * standalone `/circuit` route) so the shortcuts don't also fire when the
 * circuit tab is just one of several visible in the embedded dashboard
 * preview.
 */
export function useCircuitShortcuts(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const { runSimulation, removeSelected, setSelectedGateType } =
        useCircuitStore.getState();

      if (e.key === " ") {
        e.preventDefault();
        runSimulation();
        return;
      }

      if (e.key === "Delete") {
        removeSelected();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "h") { setSelectedGateType("H"); return; }
      if (key === "x") { setSelectedGateType("X"); return; }
      if (key === "c") { setSelectedGateType("CX"); return; }
      if (key === "m") { setSelectedGateType("M"); return; }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
