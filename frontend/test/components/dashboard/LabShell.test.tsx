import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LabShell from "@/components/dashboard/LabShell";
import { useTutorStore } from "@/stores/tutorStore";

vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/dashboard/DashboardHeader", () => ({
  default: () => <div>HeaderMock</div>,
}));
vi.mock("@/components/dashboard/DashboardActivityBar", () => ({
  default: ({ onOpenTutor, dim }: { onOpenTutor: () => void; dim?: boolean }) => (
    <button onClick={onOpenTutor} data-dim={dim ? "true" : "false"}>
      open-tutor
    </button>
  ),
}));
vi.mock("@/components/dashboard/CurriculumSidebar", () => ({
  default: ({ onRetry }: { onRetry: () => void }) => (
    <button onClick={onRetry}>retry-courses</button>
  ),
}));
vi.mock("@/components/dashboard/DashboardTutorPanel", () => ({
  default: ({ activeTab, askedTabs }: { activeTab: string; askedTabs: Set<string> }) => (
    <div>
      <span>active-tab:{activeTab}</span>
      <span>asked-tabs:{Array.from(askedTabs).join(",")}</span>
    </div>
  ),
}));
vi.mock("@/components/shell/AuthHydrator", () => ({
  default: () => <div>AuthHydratorMock</div>,
}));

const sendMessage = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  sendMessage.mockClear();
  useTutorStore.setState({ messages: [], isStreaming: false, sendMessage });
});

describe("LabShell", () => {
  it("renders header, sidebar, and tutor panel by default", () => {
    render(
      <LabShell sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}>
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.getByText("HeaderMock")).toBeInTheDocument();
    expect(screen.getByText("AuthHydratorMock")).toBeInTheDocument();
    expect(screen.getByText("retry-courses")).toBeInTheDocument();
    expect(screen.getByText("active-tab:chat")).toBeInTheDocument();
    expect(screen.getByText("ContentSlot")).toBeInTheDocument();
  });

  it("sidebarCollapsed hides the curriculum sidebar", () => {
    render(
      <LabShell
        sidebarCollapsed
        sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}
      >
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.queryByText("retry-courses")).not.toBeInTheDocument();
  });

  it("tutorCollapsed hides the tutor panel", () => {
    render(
      <LabShell
        tutorCollapsed
        sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}
      >
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.queryByText("active-tab:chat")).not.toBeInTheDocument();
  });

  it("passes activityBarDim through to DashboardActivityBar", () => {
    render(
      <LabShell
        activityBarDim
        sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}
      >
        {() => <div>ContentSlot</div>}
      </LabShell>
    );
    expect(screen.getByText("open-tutor")).toHaveAttribute("data-dim", "true");
  });

  it("children render prop receives onExplainCircuit which sends the canned prompt", async () => {
    const user = userEvent.setup();
    render(
      <LabShell sidebarProps={{ loading: false, error: null, onRetry: vi.fn() }}>
        {({ onExplainCircuit }) => <button onClick={onExplainCircuit}>trigger-explain</button>}
      </LabShell>
    );
    await user.click(screen.getByText("trigger-explain"));
    expect(sendMessage).toHaveBeenCalledWith("Explain my circuit");
    await waitFor(() => expect(screen.getByText("active-tab:explain")).toBeInTheDocument());
  });
});
