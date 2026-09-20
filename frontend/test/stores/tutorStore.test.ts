import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Citation } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

let capturedOnToken: ((token: string) => void) | null = null;
let capturedOnComplete:
  | ((payload: { content?: string; citations?: Citation[]; error?: string }) => void)
  | null = null;
let unsubscribed = false;

vi.mock("@/lib/supabase", () => ({
  subscribeToTutor: vi.fn(
    (
      _sessionId: string,
      handlers: {
        onToken: (token: string) => void;
        onComplete: (payload: { content?: string; citations?: Citation[]; error?: string }) => void;
      }
    ) => {
      capturedOnToken = handlers.onToken;
      capturedOnComplete = handlers.onComplete;
      return () => {
        unsubscribed = true;
      };
    }
  ),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ session_id: "s", status: "pending" }),
}));

// ---------------------------------------------------------------------------
import { useTutorStore } from "@/stores/tutorStore";
import { useAuthStore } from "@/stores/authStore";
import { useLearningStore } from "@/stores/learningStore";
import { useShellStore } from "@/stores/shellStore";
import { apiFetch } from "@/lib/api";
import { subscribeToTutor } from "@/lib/supabase";

beforeEach(() => {
  capturedOnToken = null;
  capturedOnComplete = null;
  unsubscribed = false;

  useTutorStore.setState({ messages: [], isStreaming: false });
  useAuthStore.setState({ jwt: "jwt-token", user: null, isLoading: false });
  useLearningStore.setState({ currentLessonId: "lesson-1" });
  useShellStore.setState({ rightPanelOpen: false });

  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue({ session_id: "s", status: "pending" } as never);
  vi.mocked(subscribeToTutor).mockImplementation((_id, handlers) => {
    capturedOnToken = handlers.onToken;
    capturedOnComplete = handlers.onComplete;
    return () => {
      unsubscribed = true;
    };
  });
});

describe("sendMessage", () => {
  it("sets isStreaming and appends a user + empty assistant message", async () => {
    await useTutorStore.getState().sendMessage("What is superposition?");

    const { messages, isStreaming } = useTutorStore.getState();
    expect(isStreaming).toBe(true);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What is superposition?");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("");
  });

  it("subscribes before POSTing to /api/v1/tutor/chat with message, session_id, lesson_id", async () => {
    await useTutorStore.getState().sendMessage("Explain entanglement");

    expect(subscribeToTutor).toHaveBeenCalledOnce();
    const subId = vi.mocked(subscribeToTutor).mock.calls[0][0];

    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, opts] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe("/api/v1/tutor/chat");
    expect(opts!.method).toBe("POST");
    expect(opts!.token).toBe("jwt-token");

    const body = JSON.parse(opts!.body as string);
    expect(body.message).toBe("Explain entanglement");
    expect(body.session_id).toBe(subId); // same UUID used to subscribe
    expect(body.lesson_id).toBe("lesson-1");
  });

  it("accumulates streamed tokens into the assistant message", async () => {
    await useTutorStore.getState().sendMessage("hi");
    expect(capturedOnToken).not.toBeNull();

    capturedOnToken!("He");
    capturedOnToken!("llo");

    const assistant = useTutorStore.getState().messages[1];
    expect(assistant.content).toBe("Hello");
  });

  it("onComplete sets citations, clears isStreaming, opens RightPanel, unsubscribes", async () => {
    await useTutorStore.getState().sendMessage("hi");
    expect(capturedOnComplete).not.toBeNull();

    const citations: Citation[] = [{ title: "Superposition", url: "u", score: 0.9 }];
    capturedOnComplete!({ content: "Hello", citations });

    const assistant = useTutorStore.getState().messages[1];
    expect(assistant.citations).toEqual(citations);
    expect(useTutorStore.getState().isStreaming).toBe(false);
    expect(useShellStore.getState().rightPanelOpen).toBe(true);
    expect(unsubscribed).toBe(true);
  });

  it("onComplete with an error clears isStreaming without throwing", async () => {
    await useTutorStore.getState().sendMessage("hi");
    capturedOnComplete!({ error: "llm exploded" });

    expect(useTutorStore.getState().isStreaming).toBe(false);
  });
});
