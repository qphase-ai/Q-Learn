import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TutorFAB from "@/components/shell/TutorFAB";
import { useShellStore } from "@/stores/shellStore";

vi.mock("@/stores/tutorStore", () => ({
  useTutorStore: (sel: (s: { messages: []; isStreaming: boolean; suggestedPrompts: string[]; sendMessage: () => void }) => unknown) =>
    sel({ messages: [], isStreaming: false, suggestedPrompts: [], sendMessage: vi.fn() }),
}));

beforeEach(() => {
  useShellStore.setState({ tutorOpen: false });
});

describe("TutorFAB", () => {
  it("renders the open FAB when tutor is closed", () => {
    render(<TutorFAB />);
    expect(screen.getByRole("button", { name: /open ai tutor/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /ai tutor/i })).not.toBeInTheDocument();
  });

  it("shows the tutor dialog when tutorOpen is true", () => {
    useShellStore.setState({ tutorOpen: true });
    render(<TutorFAB />);
    expect(screen.getByRole("dialog", { name: /ai tutor/i })).toBeInTheDocument();
  });

  it("clicking the FAB toggles tutorOpen to true", () => {
    render(<TutorFAB />);
    fireEvent.click(screen.getByRole("button", { name: /open ai tutor/i }));
    expect(useShellStore.getState().tutorOpen).toBe(true);
  });

  it("clicking the close button sets tutorOpen to false", () => {
    useShellStore.setState({ tutorOpen: true });
    render(<TutorFAB />);
    fireEvent.click(screen.getByRole("button", { name: /close ai tutor/i }));
    expect(useShellStore.getState().tutorOpen).toBe(false);
  });
});
