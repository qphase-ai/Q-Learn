"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClassroomStore } from "@/stores/classroomStore";

export default function StepIndicator({ className }: { className?: string }) {
  const steps = useClassroomStore((s) => s.steps);
  const active = useClassroomStore((s) => s.board.active_step);
  if (steps.length === 0) return null;

  return (
    <nav aria-label="Lesson steps" className={className}>
      <ol className="flex flex-wrap gap-2 text-xs">
        {steps.map((st, i) => {
          const current = st.id === active;
          return (
            <li
              key={st.id}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                current
                  ? "border-cyber-cyan/60 bg-cyber-cyan/10 text-cyber-cyan"
                  : st.done
                    ? "border-overlay/10 text-muted-foreground"
                    : "border-overlay/10 text-foreground"
              )}
            >
              {st.done ? <Check size={12} aria-hidden /> : <span aria-hidden>{i + 1}</span>}
              <span>{st.title}</span>
              {st.done && <span className="sr-only">(done)</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
