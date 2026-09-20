import { create } from "zustand";
import type { Citation, TutorMessage } from "@/types";
import { apiFetch } from "@/lib/api";
import { subscribeToTutor } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useLearningStore } from "@/stores/learningStore";
import { useShellStore } from "@/stores/shellStore";

interface TutorStore {
  messages: TutorMessage[];
  isStreaming: boolean;
  suggestedPrompts: string[];
  addMessage: (message: TutorMessage) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: () => void;
  sendMessage: (message: string) => Promise<void>;
}

export const useTutorStore = create<TutorStore>((set) => ({
  messages: [],
  isStreaming: false,
  suggestedPrompts: [
    "Explain superposition with an example",
    "What is quantum entanglement?",
    "Show me a Bell state circuit",
  ],
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  clearMessages: () => set({ messages: [] }),

  /**
   * Ask the tutor. Mirrors the circuit flow: subscribe to Realtime BEFORE the
   * POST so no token is missed, append the user turn plus an empty assistant
   * turn we stream into, then fire the 202 request. `complete` closes the
   * channel, sets citations, and opens the RightPanel.
   */
  sendMessage: async (message) => {
    const sessionId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    // Snapshot cross-domain state (no store-to-store imports at module scope).
    const token = useAuthStore.getState().jwt ?? undefined;
    const lessonId = useLearningStore.getState().currentLessonId;

    set((s) => ({
      isStreaming: true,
      messages: [
        ...s.messages,
        { id: crypto.randomUUID(), role: "user", content: message },
        { id: assistantId, role: "assistant", content: "" },
      ],
    }));

    const appendToken = (tok: string) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + tok } : m
        ),
      }));

    // Subscribe first — the unsubscribe is captured for use inside onComplete.
    const unsubscribe = subscribeToTutor(sessionId, {
      onToken: appendToken,
      onComplete: (payload) => {
        const citations = (payload.citations ?? []) as Citation[];
        set((s) => ({
          isStreaming: false,
          messages: s.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: payload.content ?? m.content,
                  citations,
                }
              : m
          ),
        }));
        useShellStore.setState({ rightPanelOpen: true });
        unsubscribe();
      },
    });

    try {
      await apiFetch("/api/v1/tutor/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          session_id: sessionId,
          lesson_id: lessonId,
        }),
        token,
      });
    } catch (err) {
      set({ isStreaming: false });
      unsubscribe();
      throw err;
    }
  },
}));
