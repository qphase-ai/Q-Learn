"use client";

import { useState } from "react";
import { useTutorStore } from "@/stores/tutorStore";
import ChatMessage from "@/components/tutor/ChatMessage";
import SuggestedPrompts from "@/components/tutor/SuggestedPrompts";

/**
 * The RightPanel AI Tutor. Reads conversation state from `tutorStore`, renders
 * the streamed messages + grounding citations, and drives `sendMessage`. The
 * subscribe-before-POST streaming orchestration lives in the store; this
 * component is purely presentational input/output.
 */
export default function AITutorPanel() {
  const messages = useTutorStore((s) => s.messages);
  const isStreaming = useTutorStore((s) => s.isStreaming);
  const suggestedPrompts = useTutorStore((s) => s.suggestedPrompts);
  const sendMessage = useTutorStore((s) => s.sendMessage);

  const [draft, setDraft] = useState("");

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    void sendMessage(trimmed);
    setDraft("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask about quantum concepts, gates, or your current lesson.
            </p>
            <SuggestedPrompts
              prompts={suggestedPrompts}
              onSelect={send}
              disabled={isStreaming}
            />
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        {isStreaming && (
          <p className="animate-pulse text-xs text-cyber-cyan">Tutor is thinking…</p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          type="text"
          value={draft}
          disabled={isStreaming}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the AI Tutor…"
          aria-label="Ask the AI Tutor"
          className="h-9 flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-foreground outline-none transition-colors focus:border-cyber-cyan focus:shadow-glow-cyan disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || draft.trim().length === 0}
          className="h-9 rounded-lg bg-cyber-cyan/15 px-3 text-sm font-medium text-cyber-cyan transition-colors hover:bg-cyber-cyan/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
