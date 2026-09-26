"use client";

import LabShell from "@/components/dashboard/LabShell";

/**
 * Chrome wrapper for the standalone utility routes (Progress, Settings,
 * Pricing, Docs, Feedback). Reuses the same `LabShell` header + activity bar as
 * the workspace routes, but collapses the curriculum sidebar and AI-tutor
 * columns so the page owns the full center area. The curriculum sidebar props
 * are inert here (the sidebar isn't rendered when `sidebarCollapsed`).
 */
export default function UtilityPageShell({ children }: { children: React.ReactNode }) {
  return (
    <LabShell
      sidebarCollapsed
      tutorCollapsed
      sidebarProps={{ loading: false, error: null, onRetry: () => {} }}
    >
      {() => (
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
        </main>
      )}
    </LabShell>
  );
}
