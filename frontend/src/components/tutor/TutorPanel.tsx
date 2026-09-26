"use client";

import { useState } from "react";
import {
  Sparkles,
  Wand2,
  Lightbulb,
  Target,
  Send,
  PanelRightClose,
  MessagesSquare,
} from "lucide-react";
import { useTutorStore } from "@/stores/tutorStore";
import { useLearningStore } from "@/stores/learningStore";
import { useCircuitStore } from "@/stores/circuitStore";
import { useShellStore, type TutorTab } from "@/stores/shellStore";
import { nodesToCircuitSpec, specToQiskit } from "@/lib/circuit-spec";
import ChatMessage from "@/components/tutor/ChatMessage";
import SuggestedPrompts from "@/components/tutor/SuggestedPrompts";

const TABS: { id: TutorTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "explain", label: "Explain" },
  { id: "hints", label: "Hints" },
  { id: "nextsteps", label: "Next Steps" },
];

export default function TutorPanel() {
  const messages = useTutorStore((s) => s.messages);
  const isStreaming = useTutorStore((s) => s.isStreaming);
  const suggestedPrompts = useTutorStore((s) => s.suggestedPrompts);
  const sendMessage = useTutorStore((s) => s.sendMessage);

  const activeLesson = useLearningStore((s) => s.activeLesson);
  const nodes = useCircuitStore((s) => s.nodes);
  const qubitCount = useCircuitStore((s) => s.qubitCount);

  const tab = useShellStore((s) => s.tutorTab);
  const setTab = useShellStore((s) => s.setTutorTab);
  const setTutorOpen = useShellStore((s) => s.setTutorOpen);

  const [draft, setDraft] = useState("");

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    void sendMessage(trimmed);
    setDraft("");
  };

  const lessonTitle = activeLesson?.title ?? "the current lesson";

  const explainCircuit = () => {
    const spec = nodesToCircuitSpec(nodes, qubitCount);
    const code = specToQiskit(spec, "Student Circuit");
    send(
      `Explain what this quantum circuit does, step by step, and what final state it produces. ` +
        `Use Dirac notation where helpful.\n\n\`\`\`python\n${code}\n\`\`\``
    );
  };

  const askHint = () =>
    send(`Give me a single concise hint to make progress on "${lessonTitle}" without revealing the full answer.`);

  const nextSteps = () =>
    send(`Based on "${lessonTitle}", recommend 3 concrete next steps or a small challenge I should try next to deepen my understanding.`);

  return (
    <div className="flex h-full flex-col bg-surface/60">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyber-cyan" aria-hidden />
          <span className="text-sm font-semibold text-foreground">AI Tutor</span>
          <span className="flex items-center gap-1 text-[11px] text-success">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            Online
          </span>
        </div>
        <button
          type="button"
          onClick={() => setTutorOpen(false)}
          aria-label="Collapse AI Tutor"
          title="Collapse"
          className="text-muted-foreground hover:text-foreground"
        >
          <PanelRightClose size={16} aria-hidden />
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="AI Tutor modes" className="flex gap-1 border-b border-border px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-cyber-cyan/15 text-cyber-cyan"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mode action card */}
      <div className="border-b border-border p-3">
        {tab === "explain" && (
          <ActionCard
            icon={<Wand2 size={15} />}
            title="Explain My Circuit"
            body="Get a detailed explanation of what your current circuit does."
            cta="Explain this circuit"
            onClick={explainCircuit}
            disabled={isStreaming}
          />
        )}
        {tab === "hints" && (
          <ActionCard
            icon={<Lightbulb size={15} />}
            title="Need a nudge?"
            body={`Get a hint for “${lessonTitle}” — just enough to keep you moving.`}
            cta="Give me a hint"
            onClick={askHint}
            disabled={isStreaming}
          />
        )}
        {tab === "nextsteps" && (
          <ActionCard
            icon={<Target size={15} />}
            title="Next Step Recommendation"
            body="See what to try next based on your current lesson."
            cta="Recommend next steps"
            onClick={nextSteps}
            disabled={isStreaming}
          />
        )}
        {tab === "chat" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessagesSquare size={14} aria-hidden />
            Ask anything about quantum concepts, gates, or your lesson.
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            {tab === "chat" && (
              <SuggestedPrompts prompts={suggestedPrompts} onSelect={send} disabled={isStreaming} />
            )}
            {tab !== "chat" && (
              <p className="text-xs text-muted-foreground">
                Use the action above, or ask a follow-up question below.
              </p>
            )}
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
        {isStreaming && <p className="animate-pulse text-xs text-cyber-cyan">Tutor is thinking…</p>}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          type="text"
          value={draft}
          disabled={isStreaming}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a follow-up question…"
          aria-label="Ask the AI Tutor"
          className="h-9 flex-1 rounded-lg border border-border/60 bg-elevated/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-cyber-cyan focus:shadow-glow-cyan disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || draft.trim().length === 0}
          aria-label="Send"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyber-cyan/15 text-cyber-cyan transition-colors hover:bg-cyber-cyan/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} aria-hidden />
        </button>
      </form>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  body,
  cta,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-elevated/50 p-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        <span className="text-cyber-cyan">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyber-cyan to-electric-purple px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles size={13} aria-hidden />
        {cta}
      </button>
    </div>
  );
}
