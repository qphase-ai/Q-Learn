import { create } from "zustand";
import { persist } from "zustand/middleware";

type Workspace = "dashboard" | "learn" | "circuit" | "code" | "quiz" | "settings";
type BottomPanelTab = "probabilities" | "statevector" | "qasm" | "console";
export type LessonTab = "lesson" | "circuit" | "code" | "simulation" | "practice";
export type TutorTab = "chat" | "explain" | "hints" | "nextsteps";

interface ShellStore {
  activeWorkspace: Workspace;
  tutorOpen: boolean;
  bottomPanelOpen: boolean;
  focusMode: boolean;
  bottomPanelTab: BottomPanelTab;
  // Reference-UI: active tab of the unified lesson workspace and the AI Tutor.
  lessonTab: LessonTab;
  tutorTab: TutorTab;
  setWorkspace: (workspace: Workspace) => void;
  toggleTutor: () => void;
  setTutorOpen: (open: boolean) => void;
  toggleBottomPanel: () => void;
  setFocusMode: (focus: boolean) => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  setLessonTab: (tab: LessonTab) => void;
  setTutorTab: (tab: TutorTab) => void;
}

export const useShellStore = create<ShellStore>()(
  persist(
    (set) => ({
      activeWorkspace: "dashboard",
      tutorOpen: true,
      bottomPanelOpen: false,
      focusMode: false,
      bottomPanelTab: "probabilities",
      lessonTab: "lesson",
      tutorTab: "explain",
      setWorkspace: (activeWorkspace) => set({ activeWorkspace }),
      toggleTutor: () => set((s) => ({ tutorOpen: !s.tutorOpen })),
      setTutorOpen: (tutorOpen) => set({ tutorOpen }),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setFocusMode: (focus) => set({ focusMode: focus }),
      setBottomPanelTab: (bottomPanelTab) => set({ bottomPanelTab }),
      setLessonTab: (lessonTab) => set({ lessonTab }),
      setTutorTab: (tutorTab) => set({ tutorTab }),
    }),
    {
      name: "shell",
      partialize: (s) => ({ bottomPanelOpen: s.bottomPanelOpen, tutorOpen: s.tutorOpen }),
    }
  )
);
