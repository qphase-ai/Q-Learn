"use client";

import AIResponse from "@/components/markdown/AIResponse";
import { cn } from "@/lib/utils";
import { useClassroomStore } from "@/stores/classroomStore";
import Composer from "./Composer";

const SUGGESTIONS = [
  "Explain superposition and show me a Hadamard circuit",
  "Walk me through creating a Bell state",
];

export default function ConversationPane({ className }: { className?: string }) {
  const messages = useClassroomStore((s) => s.messages);
  const status = useClassroomStore((s) => s.status);
  const agentStatus = useClassroomStore((s) => s.agentStatus);
  const error = useClassroomStore((s) => s.error);
  const restoring = useClassroomStore((s) => s.restoring);
  const sendMessage = useClassroomStore((s) => s.sendMessage);
  const interrupt = useClassroomStore((s) => s.interrupt);
  const running = status === "running";

  return (
    <section aria-label="Conversation" className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={running || restoring}
        tabIndex={0}
        className="flex-1 space-y-3 overflow-y-auto p-4 outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
      >
        {messages.length === 0 && !restoring && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Ask the AI Classroom anything about quantum computing. Circuits and equations appear on the whiteboard.</p>
            <ul className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => void sendMessage(q)}
                    className="rounded-full border border-overlay/10 px-3 py-1 text-xs text-foreground outline-none transition-colors hover:bg-overlay/5 focus-visible:ring-2 focus-visible:ring-cyber-cyan/60"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {restoring && <p className="text-xs text-muted-foreground">Restoring your classroom…</p>}
        {messages.map((m) => (
          <article
            key={m.id}
            data-role={m.role}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              m.role === "user" ? "ml-8 bg-cyber-cyan/10 text-foreground" : "mr-4 bg-overlay/[0.04] text-foreground"
            )}
          >
            <h3 className="sr-only">{m.role === "user" ? "You" : "Tutor"}</h3>
            {m.role === "user" ? (
              <p className="whitespace-pre-wrap">{m.content}</p>
            ) : (
              <AIResponse content={m.content} streaming={m.streaming} variant="chat" />
            )}
          </article>
        ))}
        {running && (
          <p role="status" className="animate-pulse text-xs text-cyber-cyan">
            {agentStatus ?? "Tutor is thinking…"}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            {error}
          </p>
        )}
      </div>
      <Composer running={running} onSend={(t) => void sendMessage(t)} onStop={() => void interrupt()} disabled={restoring} />
    </section>
  );
}
