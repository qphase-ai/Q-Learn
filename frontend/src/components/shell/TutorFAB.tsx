"use client";

import { MessageCircle, X } from "lucide-react";
import { useShellStore } from "@/stores/shellStore";
import AITutorPanel from "@/components/tutor/AITutorPanel";

export default function TutorFAB() {
  const open = useShellStore((s) => s.tutorOpen);
  const toggleTutor = useShellStore((s) => s.toggleTutor);

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="AI Tutor"
          aria-modal="false"
          className="fixed bottom-20 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface shadow-glow-cyan"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">AI Tutor</span>
            <button
              onClick={toggleTutor}
              aria-label="Dismiss tutor panel"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="h-96 min-h-0">
            <AITutorPanel />
          </div>
        </div>
      )}
      <button
        onClick={toggleTutor}
        aria-label={open ? "Close AI Tutor" : "Open AI Tutor"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-cyber-cyan text-background shadow-glow-cyan transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X size={20} aria-hidden /> : <MessageCircle size={20} aria-hidden />}
      </button>
    </>
  );
}
