import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import { getAccessToken, subscribeToClassroom } from "@/lib/supabase";
import { applyEvent, emptyBoard, parseBoardState, parseClassroomEvent } from "@/lib/whiteboard";
import { useAuthStore } from "@/stores/authStore";
import type {
  BoardState,
  ClassroomEvent,
  ClassroomMessage,
  ClassroomStateResponse,
  ClassroomStatus,
  ClassroomStep,
  ConnectionStatus,
  CreateSessionResponse,
  SessionDetailResponse,
  StartTurnResponse,
} from "@/types/classroom";

const BASE = "/api/v1/classroom";
const STORAGE_KEY = "qlearn.classroom.session";
const MAX_MESSAGE_CHARS = 2000;
const MAX_RECOVER_ATTEMPTS = 5;
const RECOVER_BACKOFF_MS = 500;

interface ClassroomStore {
  sessionId: string | null;
  status: ClassroomStatus;
  messages: ClassroomMessage[];
  board: BoardState;
  steps: ClassroomStep[];
  /** Highest contiguous durable sequence number applied. */
  lastSeq: number;
  activeTurnId: string | null;
  agentStatus: string | null;
  connection: ConnectionStatus;
  restoring: boolean;
  error: string | null;

  sendMessage: (text: string) => Promise<void>;
  interrupt: () => Promise<void>;
  restoreSaved: () => Promise<void>;
  restore: (sessionId: string) => Promise<void>;
  newSession: () => void;
  /** Feed a raw Realtime payload through validation, dedupe and ordering. */
  ingest: (raw: unknown) => void;
  /** Re-sync with `GET /state?after_seq=lastSeq` (gap or reconnect recovery). */
  recover: () => Promise<void>;
  reset: () => void;
}

// ---- Non-reactive bookkeeping (per active session) -------------------------
let unsubscribe: (() => void) | null = null;
let seen = new Set<string>();
let superseded = new Set<string>();
let pending = new Map<number, ClassroomEvent>();
let awaitingTurn = false;
let recovering = false;
let hasBeenLive = false;
let recoverAttempts = 0;
let recoverTimer: ReturnType<typeof setTimeout> | null = null;
/** Bumped on every reset so in-flight recoveries cannot schedule retries for a dead session. */
let bookkeepingEpoch = 0;

function clearBookkeeping() {
  unsubscribe?.();
  unsubscribe = null;
  seen = new Set();
  superseded = new Set();
  pending = new Map();
  awaitingTurn = false;
  recovering = false;
  hasBeenLive = false;
  recoverAttempts = 0;
  if (recoverTimer) clearTimeout(recoverTimer);
  recoverTimer = null;
  bookkeepingEpoch += 1;
}

function persistSession(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — reload simply starts fresh */
  }
}

function readSavedSession(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function authToken(): Promise<string | undefined> {
  return (await getAccessToken()) ?? useAuthStore.getState().jwt ?? undefined;
}

const INITIAL = {
  sessionId: null as string | null,
  status: "idle" as ClassroomStatus,
  messages: [] as ClassroomMessage[],
  board: emptyBoard(),
  steps: [] as ClassroomStep[],
  lastSeq: 0,
  activeTurnId: null as string | null,
  agentStatus: null as string | null,
  connection: "disconnected" as ConnectionStatus,
  restoring: false,
  error: null as string | null,
};

const assistantKey = (turnId: string) => `turn:${turnId}`;

export const useClassroomStore = create<ClassroomStore>((set, get) => {
  // -- content application (shared by live, replay and recovery paths) ------
  function finishStreaming(messages: ClassroomMessage[]): ClassroomMessage[] {
    return messages.map((m) => (m.streaming ? { ...m, streaming: false } : m));
  }

  function applyContent(ev: ClassroomEvent) {
    const p = ev.payload;
    switch (ev.type) {
      case "agent.status":
        if (typeof p.label === "string") set({ agentStatus: p.label.slice(0, 120) });
        return;
      case "message.delta": {
        if (typeof p.text !== "string") return;
        const id = assistantKey(ev.turn_id);
        set((s) => {
          const exists = s.messages.some((m) => m.id === id);
          const messages = exists
            ? s.messages.map((m) => (m.id === id ? { ...m, content: m.content + p.text, streaming: true } : m))
            : [...s.messages, { id, role: "assistant" as const, content: p.text as string, streaming: true }];
          return { messages, status: "running" };
        });
        return;
      }
      case "message.completed": {
        if (typeof p.content !== "string") return;
        const messageId = typeof p.message_id === "string" ? p.message_id : assistantKey(ev.turn_id);
        const tmp = assistantKey(ev.turn_id);
        set((s) => {
          const done: ClassroomMessage = { id: messageId, role: "assistant", content: p.content as string, streaming: false };
          const idx = s.messages.findIndex((m) => m.id === tmp || m.id === messageId);
          const messages =
            idx === -1
              ? [...s.messages, done]
              : s.messages.map((m, i) => (i === idx ? { ...m, ...done } : m));
          return { messages, status: "idle", agentStatus: null };
        });
        return;
      }
      case "whiteboard.action": {
        const a = p.action;
        set((s) => {
          const board = applyEvent(s.board, ev);
          if (board === s.board) return {};
          let steps = s.steps;
          if (a === "step_started" && typeof p.title === "string") {
            const id = ev.step_id ?? ev.event_id;
            if (!steps.some((st) => st.id === id)) steps = [...steps, { id, title: p.title.trim(), done: false }];
          } else if (a === "step_completed") {
            const id = ev.step_id ?? s.board.active_step;
            steps = steps.map((st) => (st.id === id ? { ...st, done: true } : st));
          }
          const next: Partial<ClassroomStore> = { board, steps };
          if (a === "tutor_error" && typeof p.message === "string") next.error = p.message;
          return next;
        });
        return;
      }
      case "classroom.error": {
        const message = typeof p.message === "string" ? p.message : "The classroom ran into a problem.";
        set((s) => ({ error: message, status: "failed", agentStatus: null, messages: finishStreaming(s.messages) }));
        return;
      }
    }
  }

  /** Apply a durable event that is next in sequence, then drain the buffer. */
  function commitDurable(ev: ClassroomEvent) {
    applyContent(ev);
    let seq = ev.sequence_no as number;
    set({ lastSeq: seq });
    for (let next = pending.get(seq + 1); next; next = pending.get(seq + 1)) {
      pending.delete(seq + 1);
      applyContent(next);
      seq += 1;
      set({ lastSeq: seq });
    }
    for (const k of Array.from(pending.keys())) if (k <= seq) pending.delete(k);
  }

  /** Turn filter for LIVE events only. Returns false for superseded/foreign turns. */
  function acceptTurn(ev: ClassroomEvent): boolean {
    if (superseded.has(ev.turn_id)) return false;
    const { activeTurnId } = get();
    if (activeTurnId === ev.turn_id) return true;
    if (activeTurnId === null || awaitingTurn) {
      // Adopt: first event of the turn we just asked for (the 202 may still be in flight).
      if (activeTurnId !== null) superseded.add(activeTurnId);
      set({ activeTurnId: ev.turn_id });
      return true;
    }
    // A different turn than the one we are following: it was superseded elsewhere.
    superseded.add(ev.turn_id);
    return false;
  }

  function subscribe(sessionId: string) {
    unsubscribe?.();
    set({ connection: "connecting" });
    unsubscribe = subscribeToClassroom(sessionId, {
      onEvent: (raw) => get().ingest(raw),
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          const reconnect = hasBeenLive;
          hasBeenLive = true;
          set({ connection: "live" });
          if (reconnect) void get().recover();
        } else if (status === "CLOSED") {
          set({ connection: "disconnected" });
        } else {
          set({ connection: "error" });
        }
      },
    });
  }

  /** Apply a server state response (snapshot + replay) authoritatively. */
  function applyState(res: ClassroomStateResponse) {
    const board = res.snapshot ? parseBoardState(res.snapshot.board_state) : null;
    if (res.snapshot && board && res.snapshot.last_sequence_no > get().lastSeq) {
      set({ board, lastSeq: res.snapshot.last_sequence_no });
    }
    const events = (res.events ?? [])
      .map(parseClassroomEvent)
      .filter((e): e is ClassroomEvent => e !== null && e.sequence_no !== null)
      .sort((a, b) => (a.sequence_no as number) - (b.sequence_no as number));
    for (const ev of events) {
      const seq = ev.sequence_no as number;
      if (seq <= get().lastSeq) continue; // already applied (snapshot or live)
      if (seq !== get().lastSeq + 1) {
        pending.set(seq, ev); // server log has a hole — keep for a later retry
        continue;
      }
      seen.add(ev.event_id);
      commitDurable(ev);
    }
    if (res.status === "running" && get().status !== "running") set({ status: "running" });
  }

  return {
    ...INITIAL,

    ingest: (raw) => {
      const ev = parseClassroomEvent(raw);
      if (!ev) return;
      const s = get();
      if (ev.session_id !== s.sessionId) return;
      if (seen.has(ev.event_id)) return;
      if (ev.sequence_no !== null && ev.sequence_no <= s.lastSeq) return; // duplicate durable
      if (!acceptTurn(ev)) return;
      seen.add(ev.event_id);

      if (ev.sequence_no === null) {
        applyContent(ev);
        return;
      }
      if (ev.sequence_no === s.lastSeq + 1) {
        commitDurable(ev);
        return;
      }
      pending.set(ev.sequence_no, ev); // gap: hold it and fetch what we missed
      void get().recover();
    },

    recover: async () => {
      const { sessionId } = get();
      if (!sessionId || recovering) return;
      recovering = true;
      const epoch = bookkeepingEpoch;
      try {
        const res = await apiFetch<ClassroomStateResponse>(
          `${BASE}/sessions/${sessionId}/state?after_seq=${get().lastSeq}`,
          { token: await authToken() }
        );
        if (get().sessionId !== sessionId) return;
        applyState(res);
        // Buffered events may now be contiguous.
        const next = pending.get(get().lastSeq + 1);
        if (next) {
          pending.delete(get().lastSeq + 1);
          commitDurable(next);
        }
      } catch (err) {
        console.warn("classroom state recovery failed", err);
      } finally {
        if (epoch === bookkeepingEpoch) {
          recovering = false;
          if (get().sessionId === sessionId) {
            if (pending.size === 0) {
              recoverAttempts = 0;
            } else if (recoverAttempts < MAX_RECOVER_ATTEMPTS) {
              // A gap event arrived mid-fetch, or the response predated it: retry, bounded.
              recoverAttempts += 1;
              if (recoverTimer) clearTimeout(recoverTimer);
              recoverTimer = setTimeout(() => {
                recoverTimer = null;
                if (epoch === bookkeepingEpoch && get().sessionId === sessionId) void get().recover();
              }, RECOVER_BACKOFF_MS * recoverAttempts);
            }
          }
        }
      }
    },

    sendMessage: async (text) => {
      const message = text.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!message) return;
      set({ error: null });

      try {
        let sessionId = get().sessionId;
        const token = await authToken();
        if (!sessionId) {
          const created = await apiFetch<CreateSessionResponse>(`${BASE}/sessions`, { method: "POST", body: "{}", token });
          sessionId = created.session_id;
          clearBookkeeping();
          set({ ...INITIAL, sessionId });
          persistSession(sessionId);
        }
        // Subscribe BEFORE the turn POST so no early event is missed.
        if (!unsubscribe) subscribe(sessionId);

        const previous = get().activeTurnId;
        if (previous) superseded.add(previous);
        awaitingTurn = true;
        const clientMessageId = crypto.randomUUID();
        set((s) => ({
          status: "running",
          activeTurnId: null,
          agentStatus: null,
          messages: [
            ...finishStreaming(s.messages),
            { id: clientMessageId, role: "user", content: message },
          ],
        }));

        const turn = await apiFetch<StartTurnResponse>(`${BASE}/sessions/${sessionId}/turns`, {
          method: "POST",
          body: JSON.stringify({ message, client_message_id: clientMessageId }),
          token,
        });
        // The 202 is authoritative: drop any turn we adopted early by mistake.
        const adopted = get().activeTurnId;
        if (adopted && adopted !== turn.turn_id) superseded.add(adopted);
        awaitingTurn = false;
        set({ activeTurnId: turn.turn_id });
      } catch (err) {
        awaitingTurn = false;
        const detail = err instanceof Error ? err.message : "Request failed";
        set((s) => ({
          status: "idle",
          error: `Couldn't reach the AI Classroom: ${detail}`,
          messages: finishStreaming(s.messages),
        }));
      }
    },

    interrupt: async () => {
      const { sessionId, status } = get();
      if (!sessionId || status !== "running") return;
      try {
        await apiFetch(`${BASE}/sessions/${sessionId}/interrupt`, { method: "POST", token: await authToken() });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : "Couldn't stop the tutor" });
        return;
      }
      const turn = get().activeTurnId;
      if (turn) superseded.add(turn);
      awaitingTurn = false;
      set((s) => ({ status: "idle", activeTurnId: null, agentStatus: null, messages: finishStreaming(s.messages) }));
      void get().recover(); // pick up anything persisted just before the stop
    },

    restore: async (sessionId) => {
      clearBookkeeping();
      set({ ...INITIAL, sessionId, restoring: true });
      subscribe(sessionId);
      try {
        const token = await authToken();
        const [detail, state] = await Promise.all([
          apiFetch<SessionDetailResponse>(`${BASE}/sessions/${sessionId}`, { token }),
          apiFetch<ClassroomStateResponse>(`${BASE}/sessions/${sessionId}/state?after_seq=0`, { token }),
        ]);
        if (get().sessionId !== sessionId) return;
        set({
          status: detail.status,
          messages: (detail.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })),
        });
        applyState(state);
        set({ restoring: false });
      } catch (err) {
        if (get().sessionId !== sessionId) return;
        // Start clean; whether the saved id survives depends on the failure kind.
        const notFound = (err as { code?: unknown } | null)?.code === "NOT_FOUND";
        clearBookkeeping();
        // Only forget the saved id when the server says it doesn't exist; a network
        // blip/5xx/429/expired token must not lose the student's classroom.
        if (notFound) persistSession(null);
        const detail = err instanceof Error ? err.message : "";
        set({
          ...INITIAL,
          error: notFound
            ? `Couldn't restore your classroom: ${detail}`
            : `Couldn't restore your classroom${detail ? `: ${detail}` : ""}. Please try again.`,
        });
      }
    },

    restoreSaved: async () => {
      const saved = readSavedSession();
      if (!saved || get().sessionId === saved) return;
      await get().restore(saved);
    },

    newSession: () => {
      clearBookkeeping();
      persistSession(null);
      set({ ...INITIAL });
    },

    reset: () => {
      clearBookkeeping();
      set({ ...INITIAL });
    },
  };
});
