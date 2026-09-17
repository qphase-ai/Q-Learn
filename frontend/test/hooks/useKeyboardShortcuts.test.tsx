import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useShellStore } from "@/stores/shellStore";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Harness() {
  useKeyboardShortcuts();
  return null;
}

beforeEach(() => {
  push.mockClear();
  useShellStore.setState({ rightPanelOpen: true, bottomPanelOpen: false });
});

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true }));
}

describe("useKeyboardShortcuts", () => {
  it("Ctrl+B toggles the right panel", () => {
    render(<Harness />);
    press("b");
    expect(useShellStore.getState().rightPanelOpen).toBe(false);
  });

  it("Ctrl+J toggles the bottom panel", () => {
    render(<Harness />);
    press("j");
    expect(useShellStore.getState().bottomPanelOpen).toBe(true);
  });

  it("Ctrl+3 navigates to the circuit workspace", () => {
    render(<Harness />);
    press("3");
    expect(push).toHaveBeenCalledWith("/circuit");
  });
});
