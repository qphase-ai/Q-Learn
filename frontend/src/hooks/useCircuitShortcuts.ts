"use client";

import { useEffect } from "react";
import { useCircuitStore } from "@/stores/circuitStore";
import { GATE_SEARCH_ID } from "@/components/circuit/library/GateLibrary";
import type { GateNodeData } from "@/types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * Wires the circuit-editor shortcuts. Pass `enabled: false` to mount the
 * listener without activating it — callers pass `enabled: true` only when
 * `lockedTab === "circuit"` (i.e. on the standalone `/circuit` route) so the
 * shortcuts don't also fire when the circuit tab is just one of several
 * visible in the embedded dashboard preview.
 *
 * Space run · Delete/Backspace delete · H/X/C/M arm a gate · Esc cancel ·
 * Ctrl/⌘+Z undo · Ctrl/⌘+Shift+Z or Ctrl+Y redo · Ctrl/⌘+D duplicate ·
 * / focus gate search · arrows move the selected gate one cell.
 */
export function useCircuitShortcuts(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const store = useCircuitStore.getState();
      const key = e.key.toLowerCase();

      // ── Modifier shortcuts ──────────────────────────────────────────────
      if (e.ctrlKey || e.metaKey) {
        if (e.altKey) return;
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          store.undo();
        } else if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          store.redo();
        } else if (key === "d") {
          e.preventDefault();
          store.duplicateSelected();
        }
        return;
      }
      if (e.altKey) return;

      if (e.key === " ") {
        // Let focused buttons/links activate normally.
        if (e.target instanceof HTMLElement && e.target.closest("button, a, [role='button']")) return;
        e.preventDefault();
        store.runSimulation();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        store.removeSelected();
        return;
      }

      if (e.key === "Escape") {
        if (store.selectedGateType) store.setSelectedGateType(null);
        else store.selectGate(null);
        return;
      }

      if (e.key === "/") {
        const search = document.getElementById(GATE_SEARCH_ID);
        if (search) {
          e.preventDefault();
          search.focus();
        }
        return;
      }

      const arrow = ARROWS[e.key];
      if (arrow) {
        const selected = store.nodes.filter((n) => n.selected);
        if (selected.length !== 1) return;
        e.preventDefault();
        const d = selected[0].data as GateNodeData;
        store.moveGate(selected[0].id, d.qubit + arrow[0], d.column + arrow[1]);
        return;
      }

      if (e.shiftKey) return;
      if (key === "h") { store.setSelectedGateType("H"); return; }
      if (key === "x") { store.setSelectedGateType("X"); return; }
      if (key === "c") { store.setSelectedGateType("CX"); return; }
      if (key === "m") { store.setSelectedGateType("M"); return; }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
