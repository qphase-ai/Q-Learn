"use client";

import { useShellStore } from "@/stores/shellStore";

export default function RightPanel() {
  const open = useShellStore((s) => s.rightPanelOpen);
  if (!open) return null;

  return (
    <aside
      aria-label="AI Tutor"
      className="shell-panel-transition flex w-[380px] flex-col border-l border-border bg-surface"
    >
      <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        AI Tutor
      </div>
      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
        The AI Tutor arrives in Slice 2.
      </div>
    </aside>
  );
}
