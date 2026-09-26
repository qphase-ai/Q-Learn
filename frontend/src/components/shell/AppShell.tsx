"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PanelRightOpen, Sparkles } from "lucide-react";
import GlobalHeader from "@/components/shell/GlobalHeader";
import LeftNav from "@/components/shell/LeftNav";
import TutorPanel from "@/components/tutor/TutorPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuth } from "@/hooks/useAuth";
import { useShellStore } from "@/stores/shellStore";
import { workspaceFromPathname } from "@/lib/workspaces";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setWorkspace = useShellStore((s) => s.setWorkspace);
  const tutorOpen = useShellStore((s) => s.tutorOpen);
  const setTutorOpen = useShellStore((s) => s.setTutorOpen);
  const { hydrate } = useAuth();

  useKeyboardShortcuts();

  useEffect(() => {
    hydrate().catch(() => {});
    // On small screens, don't auto-open the tutor drawer on first load.
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setTutorOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = workspaceFromPathname(pathname ?? "");
    if (id) setWorkspace(id);
  }, [pathname, setWorkspace]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <GlobalHeader />

      <div className="flex flex-1 overflow-hidden">
        <LeftNav />

        <main className="shell-fade flex-1 overflow-hidden">{children}</main>

        {/* Desktop persistent tutor: full panel when open, thin rail when collapsed */}
        {tutorOpen ? (
          <aside
            aria-label="AI Tutor"
            className="hidden w-[360px] flex-shrink-0 border-l border-border lg:flex xl:w-[380px]"
          >
            <TutorPanel />
          </aside>
        ) : (
          <div className="hidden w-12 flex-shrink-0 flex-col items-center border-l border-border bg-surface py-3 lg:flex">
            <button
              type="button"
              onClick={() => setTutorOpen(true)}
              aria-label="Open AI Tutor"
              title="Open AI Tutor (Ctrl+B)"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-cyber-cyan hover:bg-elevated"
            >
              <PanelRightOpen size={18} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* Mobile / tablet tutor drawer */}
      <div className="lg:hidden">
        {tutorOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setTutorOpen(false)}
            aria-hidden
          />
        )}
        <aside
          aria-label="AI Tutor"
          className={`fixed inset-y-0 right-0 z-50 w-[88%] max-w-sm border-l border-border bg-surface transition-transform duration-200 ${
            tutorOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <TutorPanel />
        </aside>
        {!tutorOpen && (
          <button
            type="button"
            onClick={() => setTutorOpen(true)}
            aria-label="Open AI Tutor"
            className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyber-cyan to-electric-purple text-background shadow-glow-cyan"
          >
            <Sparkles size={20} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
