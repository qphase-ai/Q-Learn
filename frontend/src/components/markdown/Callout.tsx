import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CalloutKind = "note" | "warning" | "tip" | "takeaway";

const STYLES: Record<CalloutKind, string> = {
  note: "border-cyber-cyan/60 bg-cyber-cyan/10",
  warning: "border-warning/70 bg-warning/10",
  tip: "border-neon-green/60 bg-neon-green/10",
  takeaway: "border-electric-purple/60 bg-electric-purple/10",
};

const LABELS: Record<CalloutKind, string> = {
  note: "Note",
  warning: "Warning",
  tip: "Tip",
  takeaway: "Key takeaway",
};

/** Typed callout box. Content (including its bold title) is passed as children. */
export function Callout({ kind, children }: { kind: CalloutKind; children: ReactNode }) {
  return (
    <aside
      role="note"
      aria-label={LABELS[kind]}
      data-callout={kind}
      className={cn("ai-callout my-3 rounded-md border-l-4 px-3 py-2 text-foreground", STYLES[kind])}
    >
      {children}
    </aside>
  );
}

export default Callout;
