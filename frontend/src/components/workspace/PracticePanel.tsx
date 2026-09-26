"use client";

import { Target, Sparkles, CircuitBoard, GraduationCap } from "lucide-react";
import { useLearningStore } from "@/stores/learningStore";
import { useShellStore } from "@/stores/shellStore";
import { useTutorStore } from "@/stores/tutorStore";

/**
 * Practice is built from real lesson data — the lesson's concepts, a deep-link
 * into the circuit builder, and AI-generated practice via the real tutor
 * (`/tutor/chat`). No hardcoded question banks.
 */
export default function PracticePanel() {
  const activeLesson = useLearningStore((s) => s.activeLesson);
  const setLessonTab = useShellStore((s) => s.setLessonTab);
  const setTutorOpen = useShellStore((s) => s.setTutorOpen);
  const setTutorTab = useShellStore((s) => s.setTutorTab);
  const sendMessage = useTutorStore((s) => s.sendMessage);
  const isStreaming = useTutorStore((s) => s.isStreaming);

  const title = activeLesson?.title ?? "this lesson";
  const concepts = activeLesson?.concepts ?? [];

  const generatePractice = () => {
    setTutorTab("chat");
    setTutorOpen(true);
    void sendMessage(
      `Create 3 short practice questions (with brief answers hidden after each) to test my understanding of "${title}". Keep them focused and progressively harder.`
    );
  };

  if (!activeLesson) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <GraduationCap size={26} className="text-muted-foreground/50" aria-hidden />
        <p className="text-sm">Select a lesson to practice its concepts.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-5 overflow-y-auto p-6">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Target size={18} className="text-cyber-cyan" aria-hidden />
          Practice: {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reinforce what you learned with concept review, a hands-on challenge, and adaptive
          AI-generated questions.
        </p>
      </header>

      {/* Concepts */}
      <section className="rounded-xl border border-border/60 bg-surface/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Key concepts
        </h3>
        {concepts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No tagged concepts for this lesson yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {concepts.map((c) => (
              <li key={c.id} className="rounded-lg bg-elevated/50 px-3 py-2">
                <div className="text-sm font-medium text-foreground">{c.name}</div>
                {c.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{c.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setLessonTab("circuit")}
          className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-surface/50 p-4 text-left transition-colors hover:border-cyber-cyan/50 hover:bg-elevated/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CircuitBoard size={16} className="text-cyber-cyan" aria-hidden />
            Try This Challenge
          </span>
          <span className="text-xs text-muted-foreground">
            Open the circuit builder and construct the circuit for this lesson.
          </span>
        </button>

        <button
          type="button"
          onClick={generatePractice}
          disabled={isStreaming}
          className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-surface/50 p-4 text-left transition-colors hover:border-electric-purple/50 hover:bg-elevated/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles size={16} className="text-electric-purple" aria-hidden />
            Generate Practice Questions
          </span>
          <span className="text-xs text-muted-foreground">
            The AI Tutor creates practice questions tailored to this lesson.
          </span>
        </button>
      </div>
    </div>
  );
}
