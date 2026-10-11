"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

export interface ComposerProps {
  running: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  disabled?: boolean;
}

/**
 * Text composer. Enter sends, Shift+Enter inserts a newline, Escape stops a
 * running turn. While a turn runs the Send button is replaced by Stop, which
 * is a real button (Tab + Enter/Space).
 */
export default function Composer({ running, onSend, onStop, disabled = false }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const canSend = !running && !disabled && draft.trim().length > 0;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(draft.trim());
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape" && running) {
      e.preventDefault();
      onStop();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-overlay/10 p-3">
      <label htmlFor="classroom-composer" className="sr-only">
        Ask the AI Classroom
      </label>
      <textarea
        id="classroom-composer"
        rows={2}
        maxLength={2000}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask a question, e.g. “Show me a Hadamard circuit”"
        aria-describedby="classroom-composer-hint"
        className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-overlay/10 bg-overlay/[0.02] px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-cyber-cyan focus-visible:ring-2 focus-visible:ring-cyber-cyan/60 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span id="classroom-composer-hint" className="sr-only">
        Press Enter to send, Shift+Enter for a new line, Escape to stop the tutor.
      </span>
      {running ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-error/15 px-3 text-sm font-medium text-error outline-none transition-colors hover:bg-error/25 focus-visible:ring-2 focus-visible:ring-error/60"
        >
          <Square size={14} aria-hidden /> Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-cyber-cyan/15 px-3 text-sm font-medium text-cyber-cyan outline-none transition-colors hover:bg-cyber-cyan/25 focus-visible:ring-2 focus-visible:ring-cyber-cyan/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={14} aria-hidden /> Send
        </button>
      )}
    </form>
  );
}
