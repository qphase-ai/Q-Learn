"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  CircuitBoard,
  CodeXml,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { WORKSPACES, workspaceFromPathname, type WorkspaceId } from "@/lib/workspaces";

const ICONS: Record<WorkspaceId, LucideIcon> = {
  dashboard: LayoutDashboard,
  learn: BookOpen,
  circuit: CircuitBoard,
  code: CodeXml,
  quiz: ListChecks,
  settings: Settings,
};

export default function ActivityBar() {
  const pathname = usePathname();
  const active = workspaceFromPathname(pathname ?? "");

  return (
    <nav
      aria-label="Workspaces"
      className="flex h-full w-12 flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--bg-surface)] py-2"
    >
      {WORKSPACES.map((w) => {
        const Icon = ICONS[w.id];
        const isActive = w.id === active;
        return (
          <Link
            key={w.id}
            href={w.href}
            aria-label={w.label}
            aria-current={isActive ? "page" : undefined}
            title={w.label}
            className={`shell-active-border flex h-10 w-10 items-center justify-center rounded-sm border-l-2 ${
              isActive
                ? "border-[var(--quantum)] text-[var(--quantum)]"
                : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon size={20} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
