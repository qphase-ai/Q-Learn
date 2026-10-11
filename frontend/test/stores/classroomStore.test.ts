import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClassroomEvent } from "@/types/classroom";

let handlers: { onEvent: (p: unknown) => void; onStatus?: (s: string) => void } | null = null;
let unsubscribed = 0;
const order: string[] = [];

vi.mock("@/lib/supabase", () => ({
  subscribeToClassroom: vi.fn((_id: string, h: typeof handlers) => {
    order.push("subscribe");
    handlers = h;
    return () => { unsubscribed++; };
  }),
  getAccessToken: vi.fn(async () => undefined),
}));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

import { useClassroomStore } from "@/stores/classroomStore";
import { apiFetch } from "@/lib/api";

const SID = "sess-1";
let n = 0;
const wb = (seq: number | null, payload: Record<string, unknown>, turn = "t1", type = "whiteboard.action"): ClassroomEvent => ({
  schema_version: 1, event_id: `e${++n}`, session_id: SID, turn_id: turn, sequence_no: seq, type, step_id: "s1", payload,
});
const circuit = (id: string) => ({ action: "draw_quantum_circuit", object_id: id, qubits: 1, gates: [{ type: "H", targets: [0] }] });
const emit = (e: ClassroomEvent) => handlers!.onEvent(e);
const st = () => useClassroomStore.getState();

function mockApi(extra: Record<string, unknown> = {}) {
  vi.mocked(apiFetch).mockImplementation((async (path: string) => {
    order.push(path);
    if (path.endsWith("/sessions")) return { session_id: SID };
    if (path.endsWith("/turns")) return { turn_id: "t1" };
    if (path in extra) return typeof extra[path] === "function" ? (extra[path] as () => unknown)() : extra[path];
    return {};
  }) as never);
}

beforeEach(() => {
  st().reset();
  handlers = null; unsubscribed = 0; order.length = 0;
  vi.clearAllMocks();
  mockApi();
});

async function start() {
  await st().sendMessage("hi");
}

describe("classroomStore", () => {
  it("creates a session, subscribes BEFORE posting the turn", async () => {
    await start();
    expect(order.indexOf("subscribe")).toBeLessThan(order.findIndex((p) => p.endsWith("/turns")));
    const call = vi.mocked(apiFetch).mock.calls.find((c) => String(c[0]).endsWith("/turns"))!;
    const body = JSON.parse(call[1]!.body as string);
    expect(body.message).toBe("hi");
    expect(body.client_message_id).toBeTruthy();
    expect(st().activeTurnId).toBe("t1");
    expect(st().status).toBe("running");
  });

  it("applies ordered events and streams deltas then completes", async () => {
    await start();
    emit(wb(1, { action: "step_started", title: "Intro" }));
    emit(wb(2, circuit("c1")));
    emit(wb(null, { text: "Hel" }, "t1", "message.delta"));
    emit(wb(null, { text: "lo" }, "t1", "message.delta"));
    expect(st().board.order).toEqual(["c1"]);
    expect(st().lastSeq).toBe(2);
    expect(st().steps[0].title).toBe("Intro");
    expect(st().messages.at(-1)!.content).toBe("Hello");
    emit(wb(null, { message_id: "m1", content: "Hello world" }, "t1", "message.completed"));
    expect(st().messages.at(-1)).toMatchObject({ id: "m1", content: "Hello world", streaming: false });
    expect(st().status).toBe("idle");
  });

  it("ignores duplicate event_id and duplicate sequence numbers", async () => {
    await start();
    const e = wb(1, circuit("c1"));
    emit(e); emit(e);
    emit(wb(1, circuit("c2"))); // same seq, new event id
    expect(st().board.order).toEqual(["c1"]);
    expect(st().board.version).toBe(1);
  });

  it("recovers from a sequence gap via GET state?after_seq", async () => {
    const missing = wb(2, circuit("c2"));
    mockApi({
      [`/api/v1/classroom/sessions/${SID}/state?after_seq=1`]: { status: "running", snapshot: null, events: [missing] },
    });
    await start();
    emit(wb(1, circuit("c1")));
    emit(wb(3, circuit("c3"))); // gap: 2 missing
    await vi.waitFor(() => expect(st().lastSeq).toBe(3));
    expect(st().board.order).toEqual(["c1", "c2", "c3"]);
    expect(vi.mocked(apiFetch).mock.calls.some((c) => String(c[0]).endsWith("state?after_seq=1"))).toBe(true);
  });

  it("ignores events from a superseded turn", async () => {
    await start();
    emit(wb(1, circuit("c1"), "t1"));
    vi.mocked(apiFetch).mockImplementation((async (p: string) => (p.endsWith("/turns") ? { turn_id: "t2" } : { session_id: SID })) as never);
    await st().sendMessage("again");
    expect(st().activeTurnId).toBe("t2");
    emit(wb(2, circuit("late"), "t1"));
    emit(wb(null, { text: "stale" }, "t1", "message.delta"));
    expect(st().board.order).toEqual(["c1"]);
    expect(st().messages.some((m) => m.content.includes("stale"))).toBe(false);
    emit(wb(2, circuit("c2"), "t2"));
    expect(st().board.order).toEqual(["c1", "c2"]);
  });

  it("drops invalid whiteboard payloads without corrupting the board", async () => {
    await start();
    emit(wb(1, { action: "draw_quantum_circuit", object_id: "x", qubits: 1, gates: [{ type: "H", targets: [5] }] }));
    expect(st().board.order).toEqual([]);
    expect(st().lastSeq).toBe(1); // sequence still consumed so no false gap
    emit(wb(2, circuit("c1")));
    expect(st().board.order).toEqual(["c1"]);
  });

  it("interrupt posts, stops the turn and ignores its late events", async () => {
    await start();
    await st().interrupt();
    expect(vi.mocked(apiFetch).mock.calls.some((c) => String(c[0]).endsWith("/interrupt"))).toBe(true);
    expect(st().status).toBe("idle");
    emit(wb(null, { text: "late" }, "t1", "message.delta"));
    expect(st().messages.some((m) => m.content === "late")).toBe(false);
  });

  it("restores snapshot + replay + history from the server", async () => {
    mockApi({
      [`/api/v1/classroom/sessions/${SID}`]: { status: "idle", messages: [{ id: "m1", role: "user", content: "q" }] },
      [`/api/v1/classroom/sessions/${SID}/state?after_seq=0`]: {
        status: "idle",
        snapshot: { last_sequence_no: 2, board_state: { version: 2, active_step: null, order: ["c1"], objects: { c1: { kind: "circuit", qubits: 1, gates: [{ type: "H", targets: [0] }] } }, highlights: [] } },
        events: [wb(2, circuit("c1")), wb(3, { action: "render_equation", object_id: "e1", latex: "x" })],
      },
    });
    await st().restore(SID);
    expect(st().board.order).toEqual(["c1", "e1"]);
    expect(st().lastSeq).toBe(3);
    expect(st().messages).toHaveLength(1);
    expect(st().restoring).toBe(false);
  });

  it("surfaces a send failure instead of throwing", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("boom"));
    await st().sendMessage("hi");
    expect(st().error).toMatch(/boom/);
    expect(st().status).toBe("idle");
  });

  it("restore keeps the saved id on a transient error and clears it on NOT_FOUND", async () => {
    const KEY = "qlearn.classroom.session";
    window.localStorage.setItem(KEY, SID);
    vi.mocked(apiFetch).mockRejectedValue(Object.assign(new Error("Service unavailable"), { code: "INTERNAL", status: 503 }));
    await st().restoreSaved();
    expect(window.localStorage.getItem(KEY)).toBe(SID);
    expect(st().error).toMatch(/try again/i);
    expect(st().sessionId).toBeNull();

    vi.mocked(apiFetch).mockRejectedValue(Object.assign(new Error("Session not found"), { code: "NOT_FOUND", status: 404 }));
    await st().restoreSaved();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(st().sessionId).toBeNull();
  });

  it("retries recovery with backoff when a gap event arrives while a fetch is in flight", async () => {
    vi.useFakeTimers();
    try {
      const missing = wb(2, circuit("c2"));
      const stateKey = `/api/v1/classroom/sessions/${SID}/state?after_seq=1`;
      let calls = 0;
      let releaseFirst!: () => void;
      mockApi({
        [stateKey]: () => {
          calls += 1;
          // First response predates the missing event; second contains it.
          if (calls === 1) return new Promise((r) => { releaseFirst = () => r({ status: "running", snapshot: null, events: [] }); });
          return { status: "running", snapshot: null, events: [missing] };
        },
      });
      await start();
      emit(wb(1, circuit("c1")));
      emit(wb(3, circuit("c3"))); // gap -> fetch #1 in flight
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toBe(1);
      emit(wb(4, circuit("c4"))); // arrives mid-fetch; recover() returns early
      releaseFirst();
      await vi.advanceTimersByTimeAsync(0);
      expect(st().lastSeq).toBe(1); // stale response did not fill the hole
      await vi.advanceTimersByTimeAsync(500);
      expect(calls).toBe(2);
      expect(st().lastSeq).toBe(4);
      expect(st().board.order).toEqual(["c1", "c2", "c3", "c4"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fire a scheduled recovery after reset", async () => {
    vi.useFakeTimers();
    try {
      mockApi({ [`/api/v1/classroom/sessions/${SID}/state?after_seq=1`]: { status: "running", snapshot: null, events: [] } });
      await start();
      emit(wb(1, circuit("c1")));
      emit(wb(3, circuit("c3")));
      await vi.advanceTimersByTimeAsync(0);
      const before = vi.mocked(apiFetch).mock.calls.length;
      st().reset();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(vi.mocked(apiFetch).mock.calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
