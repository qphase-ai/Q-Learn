"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import TitleBar from "@/components/shell/TitleBar";
import ActivityBar from "@/components/shell/ActivityBar";
import RightPanel from "@/components/shell/RightPanel";
import BottomPanel from "@/components/shell/BottomPanel";
import StatusBar from "@/components/shell/StatusBar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuth } from "@/hooks/useAuth";
import { useShellStore } from "@/stores/shellStore";
import { workspaceFromPathname } from "@/lib/workspaces";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setWorkspace = useShellStore((s) => s.setWorkspace);
  const { hydrate } = useAuth();

  useKeyboardShortcuts();

  useEffect(() => {
    hydrate().catch(() => {});
    // hydrate is stable enough for a mount-only call; deps intentionally empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = workspaceFromPathname(pathname ?? "");
    if (id) setWorkspace(id);
  }, [pathname, setWorkspace]);

  return (
    <div className="flex h-screen flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <main className="shell-fade flex-1 overflow-auto">{children}</main>
        <RightPanel />
      </div>
      <BottomPanel />
      <StatusBar />
    </div>
  );
}
