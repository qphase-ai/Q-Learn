"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import TitleBar from "@/components/shell/TitleBar";
import ActivityBar from "@/components/shell/ActivityBar";
import BottomPanel from "@/components/shell/BottomPanel";
import StatusBar from "@/components/shell/StatusBar";
import TutorFAB from "@/components/shell/TutorFAB";
import AuthHydrator from "@/components/shell/AuthHydrator";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useShellStore } from "@/stores/shellStore";
import { workspaceFromPathname } from "@/lib/workspaces";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setWorkspace = useShellStore((s) => s.setWorkspace);

  useKeyboardShortcuts();

  useEffect(() => {
    const id = workspaceFromPathname(pathname ?? "");
    if (id) setWorkspace(id);
  }, [pathname, setWorkspace]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <AuthHydrator />
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <main className="shell-fade flex-1 overflow-auto">{children}</main>
      </div>
      <BottomPanel />
      <StatusBar />
      <TutorFAB />
    </div>
  );
}
