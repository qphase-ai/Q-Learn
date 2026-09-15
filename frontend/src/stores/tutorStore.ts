import { create } from "zustand";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

interface TutorStore {
  messages: Message[];
  isStreaming: boolean;
  suggestedPrompts: string[];
  addMessage: (message: Message) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: () => void;
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
}));
