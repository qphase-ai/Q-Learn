import { create } from "zustand";
import { persist } from "zustand/middleware";

type Workspace = "dashboard" | "learn" | "circuit" | "code" | "quiz" | "settings";
type BottomPanelTab = "terminal" | "problems" | "output";

interface ShellStore {
  activeWorkspace: Workspace;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  focusMode: boolean;
  bottomPanelTab: BottomPanelTab;
  setWorkspace: (workspace: Workspace) => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setFocusMode: (focus: boolean) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
}

export const useShellStore = create<ShellStore>()(
  persist(
    (set) => ({
      activeWorkspace: "dashboard",
      rightPanelOpen: true,
      bottomPanelOpen: false,
      focusMode: false,
      bottomPanelTab: "output",
      setWorkspace: (activeWorkspace) => set({ activeWorkspace }),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setFocusMode: (focusMode) => set({ focusMode }),
      setBottomPanelTab: (bottomPanelTab) => set({ bottomPanelTab }),
    }),
    { name: "shell", partialize: (s) => ({ rightPanelOpen: s.rightPanelOpen, bottomPanelOpen: s.bottomPanelOpen }) }
  )
);
