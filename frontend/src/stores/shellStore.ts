import { create } from "zustand";

type Workspace = "dashboard" | "learn" | "circuit" | "code" | "quiz" | "settings";

interface ShellStore {
  activeWorkspace: Workspace;
  tutorOpen: boolean;
  setWorkspace: (workspace: Workspace) => void;
  toggleTutor: () => void;
}

export const useShellStore = create<ShellStore>()((set) => ({
  activeWorkspace: "dashboard",
  tutorOpen: false,
  setWorkspace: (activeWorkspace) => set({ activeWorkspace }),
  toggleTutor: () => set((s) => ({ tutorOpen: !s.tutorOpen })),
}));
