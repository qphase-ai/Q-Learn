import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardTutorPanel from "@/components/dashboard/DashboardTutorPanel";
import { useTutorStore } from "@/stores/tutorStore";

vi.mock("katex/dist/katex.min.css", () => ({}));

const sendMessage = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  sendMessage.mockClear();
  useTutorStore.setState({
    messages: [],
    isStreaming: false,
    suggestedPrompts: [],
    sendMessage: sendMessage as unknown as (m: string) => Promise<void>,
  });
});

describe("DashboardTutorPanel", () => {
  it("renders AITutorPanel (the real chat input) on the Chat tab", () => {
    render(
      <DashboardTutorPanel
        activeTab="chat"
        onTabChange={vi.fn()}
        askedTabs={new Set()}
        onAsk={vi.fn()}
        askError={null}
      />
    );
    expect(screen.getByPlaceholderText(/ask the ai tutor/i)).toBeInTheDocument();
  });

  it("shows a hero card with a CTA on an un-asked Explain tab, and calls onAsk on click", async () => {
    const onAsk = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardTutorPanel
        activeTab="explain"
        onTabChange={vi.fn()}
        askedTabs={new Set()}
        onAsk={onAsk}
        askError={null}
      />
    );
    expect(screen.getByText("Explain My Circuit")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /explain this circuit/i }));
    expect(onAsk).toHaveBeenCalledWith("explain");
  });

  it("does not render the conversation below the hero card until the tab has been asked", () => {
    render(
      <DashboardTutorPanel
        activeTab="hints"
        onTabChange={vi.fn()}
        askedTabs={new Set()}
        onAsk={vi.fn()}
        askError={null}
      />
    );
    expect(screen.queryByPlaceholderText(/ask the ai tutor/i)).not.toBeInTheDocument();
  });

  it("renders the shared conversation once a tab has been asked, with a re-ask CTA", () => {
    render(
      <DashboardTutorPanel
        activeTab="hints"
        onTabChange={vi.fn()}
        askedTabs={new Set(["hints"])}
        onAsk={vi.fn()}
        askError={null}
      />
    );
    expect(screen.getByPlaceholderText(/ask the ai tutor/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask again/i })).toBeInTheDocument();
  });

  it("surfaces an ask error under the hero card", () => {
    render(
      <DashboardTutorPanel
        activeTab="next"
        onTabChange={vi.fn()}
        askedTabs={new Set()}
        onAsk={vi.fn()}
        askError="Couldn't reach the tutor — try again."
      />
    );
    expect(screen.getByText(/couldn't reach the tutor/i)).toBeInTheDocument();
  });

  it("clicking a tab trigger calls onTabChange with that tab", async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardTutorPanel
        activeTab="chat"
        onTabChange={onTabChange}
        askedTabs={new Set()}
        onAsk={vi.fn()}
        askError={null}
      />
    );
    await user.click(screen.getByRole("tab", { name: "Next Steps" }));
    expect(onTabChange).toHaveBeenCalledWith("next");
  });
});
