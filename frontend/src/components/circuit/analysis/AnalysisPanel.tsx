"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared chrome for the State Vector / Bloch / Measurement panels. */
export default function AnalysisPanel({
  icon,
  title,
  actions,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-[248px] min-w-0 flex-col rounded-xl border border-overlay/10 bg-surface",
        className
      )}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-overlay/10 px-3 py-2">
        <span className="text-electric-purple" aria-hidden>
          {icon}
        </span>
        <h3 className="whitespace-nowrap text-xs font-semibold text-foreground">{title}</h3>
        <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">{actions}</div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>
    </section>
  );
}

export function PanelSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      aria-label={label}
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        const match = options.find((o) => String(o.value) === raw);
        if (match) onChange(match.value);
      }}
      className="h-7 rounded-md border border-overlay/10 bg-surface px-1.5 text-[11px] text-foreground outline-none transition-colors hover:border-overlay/20 focus-visible:border-cyber-cyan/60 focus-visible:ring-1 focus-visible:ring-cyber-cyan/40"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 text-center text-xs leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
