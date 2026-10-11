import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/supabase", () => ({ subscribeToClassroom: vi.fn(() => () => {}), getAccessToken: vi.fn(async () => undefined) }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import Composer from "@/components/classroom/Composer";
import { BoardView } from "@/components/classroom/Whiteboard";
import { takeStashedCircuit } from "@/lib/circuit-handoff";
import CircuitPreview, { assignColumns } from "@/components/learn/CircuitPreview";
import { applyEvent, emptyBoard } from "@/lib/whiteboard";
import type { ClassroomEvent } from "@/types/classroom";

const ev = (payload: Record<string, unknown>): ClassroomEvent => ({
  schema_version: 1, event_id: crypto.randomUUID(), session_id: "s", turn_id: "t", sequence_no: 1, type: "whiteboard.action", step_id: null, payload,
});

describe("Whiteboard", () => {
  it("renders a circuit and an equation (KaTeX) with safe annotation", () => {
    let b = emptyBoard();
    b = applyEvent(b, ev({ action: "draw_quantum_circuit", object_id: "c1", qubits: 2, gates: [{ type: "H", targets: [0] }, { type: "CX", targets: [1], control: 0 }] }));
    b = applyEvent(b, ev({ action: "render_equation", object_id: "e1", latex: "H|0\\rangle" }));
    b = applyEvent(b, ev({ action: "draw_annotation", object_id: "a1", text: "Entangles both", target_id: "c1" }));
    b = applyEvent(b, ev({ action: "highlight_object", object_id: "c1" }));
    const { container } = render(<BoardView board={b} />);
    expect(screen.getByTestId("circuit-preview")).toBeInTheDocument();
    expect(within(screen.getByTestId("circuit-preview")).getByText("H")).toBeInTheDocument();
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.getByTestId("annotation-a1")).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Entangles both" })).toBeInTheDocument();
    expect(screen.getByTestId("circuit-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("board-object-c1")).toHaveAttribute("data-highlighted", "true");
  });

  it("hands a drawn circuit off to the Circuit Builder and redirects there", async () => {
    const user = userEvent.setup();
    let b = emptyBoard();
    b = applyEvent(b, { ...ev({ action: "step_started", title: "Bell state" }), step_id: "s1" });
    b = applyEvent(b, {
      ...ev({ action: "draw_quantum_circuit", object_id: "c1", qubits: 2, gates: [{ type: "H", targets: [0] }, { type: "CX", targets: [1], control: 0 }] }),
      step_id: "s1",
    });
    render(<BoardView board={b} steps={[{ id: "s1", title: "Bell state", done: false }]} />);
    await user.click(screen.getByTestId("run-in-builder-c1"));
    expect(push).toHaveBeenCalledWith("/circuit");
    const stashed = takeStashedCircuit();
    expect(stashed).toEqual({
      qubits: 2,
      gates: [{ type: "H", targets: [0] }, { type: "CX", targets: [1], control: 0 }],
      name: "Bell state",
    });
  });
});

describe("CircuitPreview packing", () => {
  const gates = [{ type: "H", targets: [0] }, { type: "X", targets: [1] }, { type: "CX", targets: [1], control: 0 }];
  it("packs non-overlapping gates into one column; default stays sequential", () => {
    expect(assignColumns(gates, 2, true)).toEqual([0, 0, 1]);
    expect(assignColumns(gates, 2, false)).toEqual([0, 1, 2]);
    render(<CircuitPreview spec={{ qubits: 2, gates }} pack />);
    expect(screen.getByTestId("circuit-preview")).toBeInTheDocument();
  });
});

describe("Composer accessibility", () => {
  let onSend: ReturnType<typeof vi.fn>;
  let onStop: ReturnType<typeof vi.fn>;
  beforeEach(() => { onSend = vi.fn(); onStop = vi.fn(); });

  it("has a labelled textarea; Enter sends, Shift+Enter does not", async () => {
    const user = userEvent.setup();
    render(<Composer running={false} onSend={onSend} onStop={onStop} />);
    const box = screen.getByLabelText("Ask the AI Classroom");
    await user.type(box, "hello{Shift>}{Enter}{/Shift}more");
    expect(onSend).not.toHaveBeenCalled();
    await user.type(box, "{Enter}");
    expect(onSend).toHaveBeenCalledWith("hello\nmore");
    expect(box).toHaveValue("");
  });

  it("Send is disabled for empty input", () => {
    render(<Composer running={false} onSend={onSend} onStop={onStop} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows a keyboard-operable Stop button while running; Escape also stops", async () => {
    const user = userEvent.setup();
    render(<Composer running onSend={onSend} onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    await user.tab(); // textarea
    await user.keyboard("{Escape}");
    expect(onStop).toHaveBeenCalledTimes(1);
    await user.tab(); // stop button
    expect(screen.getByRole("button", { name: "Stop" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onStop).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onStop).toHaveBeenCalledTimes(3);
  });
});
