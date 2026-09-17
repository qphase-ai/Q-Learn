"use client";

import { useShellStore } from "@/stores/shellStore";

export default function RightPanel() {
  const open = useShellStore((s) => s.rightPanelOpen);
  if (!open) return null;

  return (
    <aside
      aria-label="AI Tutor"
      className="shell-panel-transition flex w-[380px] flex-col border-l border-[var(--border)] bg-[var(--bg-surface)]"
    >
      <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        AI Tutor
      </div>
      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-[var(--text-muted)]">
        The AI Tutor arrives in Slice 2.
      </div>
    </aside>
  );
}
