"use client";

import { useState } from "react";
import { MessageSquareWarning, ExternalLink } from "lucide-react";

const REPO_ISSUES = "https://github.com/qphase-ai/Q-Learn/issues/new";

type Category = "bug" | "idea" | "content" | "other";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "bug", label: "Bug" },
  { id: "idea", label: "Feature idea" },
  { id: "content", label: "Lesson content" },
  { id: "other", label: "Other" },
];

/**
 * Feedback is filed as a GitHub issue on the Q-Learn repo — no separate backend
 * submit endpoint exists, so we open the issue composer prefilled from the form
 * rather than fake a POST.
 */
export default function FeedbackView() {
  const [category, setCategory] = useState<Category>("bug");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const canSubmit = title.trim().length > 0;

  function openIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const labelMap: Record<Category, string> = {
      bug: "bug",
      idea: "enhancement",
      content: "content",
      other: "feedback",
    };
    const body = `${details.trim()}\n\n---\n_Submitted via the Q-Learn in-app feedback form._`;
    const url =
      `${REPO_ISSUES}?title=${encodeURIComponent(`[${category}] ${title.trim()}`)}` +
      `&body=${encodeURIComponent(body)}` +
      `&labels=${encodeURIComponent(labelMap[category])}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <MessageSquareWarning size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Report a bug or share an idea — it opens a prefilled GitHub issue.
          </p>
        </div>
      </header>

      <form onSubmit={openIssue} className="space-y-5 rounded-xl border border-overlay/10 bg-surface p-5">
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === c.id
                    ? "bg-cyber-cyan/15 text-cyber-cyan"
                    : "border border-overlay/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="fb-title" className="mb-2 block text-xs font-medium text-muted-foreground">
            Summary
          </label>
          <input
            id="fb-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary…"
            className="h-10 w-full rounded-lg border border-overlay/10 bg-overlay/[0.02] px-3 text-sm text-foreground outline-none focus:border-cyber-cyan"
          />
        </div>

        <div>
          <label htmlFor="fb-details" className="mb-2 block text-xs font-medium text-muted-foreground">
            Details
          </label>
          <textarea
            id="fb-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            placeholder="What happened, or what would you like to see?"
            className="w-full resize-y rounded-lg border border-overlay/10 bg-overlay/[0.02] px-3 py-2 text-sm text-foreground outline-none focus:border-cyber-cyan"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-lg bg-cyber-cyan px-4 py-2 text-sm font-semibold text-background transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ExternalLink size={15} aria-hidden />
          Open GitHub issue
        </button>
      </form>
    </div>
  );
}
