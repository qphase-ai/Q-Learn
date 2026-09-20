"use client";

/**
 * Clickable starter chips shown before a conversation begins. Selecting one
 * sends it straight to the tutor.
 */
export default function SuggestedPrompts({
  prompts,
  onSelect,
  disabled,
}: {
  prompts: string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (prompts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Try asking…</p>
      <div className="flex flex-col gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(prompt)}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-cyber-cyan hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
