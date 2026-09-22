import { create } from "zustand";
import { persist } from "zustand/middleware";

type Workspace = "dashboard" | "learn" | "circuit" | "code" | "quiz" | "settings";
type BottomPanelTab = "probabilities" | "statevector" | "qasm" | "console";

interface ShellStore {
  activeWorkspace: Workspace;
  tutorOpen: boolean;
  bottomPanelOpen: boolean;
  focusMode: boolean;
  bottomPanelTab: BottomPanelTab;
  setWorkspace: (workspace: Workspace) => void;
  toggleTutor: () => void;
  toggleBottomPanel: () => void;
  setFocusMode: (focus: boolean) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
}

export const useShellStore = create<ShellStore>()(
  persist(
    (set) => ({
      activeWorkspace: "dashboard",
      tutorOpen: false,
      bottomPanelOpen: false,
      focusMode: false,
      bottomPanelTab: "probabilities",
      setWorkspace: (activeWorkspace) => set({ activeWorkspace }),
      toggleTutor: () => set((s) => ({ tutorOpen: !s.tutorOpen })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setFocusMode: (focusMode) => set({ focusMode }),
      setBottomPanelTab: (bottomPanelTab) => set({ bottomPanelTab }),
    }),
    { name: "shell", partialize: (s) => ({ bottomPanelOpen: s.bottomPanelOpen }) }
  )
);
