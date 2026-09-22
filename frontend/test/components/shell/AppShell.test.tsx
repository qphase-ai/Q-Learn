import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "@/components/shell/AppShell";
import { useShellStore } from "@/stores/shellStore";

const hydrate = vi.fn().mockResolvedValue(undefined);
vi.mock("next/navigation", () => ({
  usePathname: () => "/circuit",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ hydrate, logout: vi.fn() }) }));
vi.mock("@/stores/tutorStore", () => ({
  useTutorStore: (sel: (s: { messages: []; isStreaming: boolean; suggestedPrompts: string[]; sendMessage: () => void }) => unknown) =>
    sel({ messages: [], isStreaming: false, suggestedPrompts: [], sendMessage: vi.fn() }),
}));

beforeEach(() => {
  hydrate.mockClear();
  useShellStore.setState({ tutorOpen: false, bottomPanelOpen: true, activeWorkspace: "dashboard", bottomPanelTab: "probabilities" });
});

describe("AppShell", () => {
  it("mounts all zones and renders children", () => {
    render(
      <AppShell>
        <div>WORKSPACE CONTENT</div>
      </AppShell>
    );
    expect(screen.getByRole("banner")).toBeInTheDocument(); // TitleBar
    expect(screen.getByRole("navigation", { name: /workspaces/i })).toBeInTheDocument(); // ActivityBar
    expect(screen.getByText("WORKSPACE CONTENT")).toBeInTheDocument(); // WorkspaceArea
    expect(screen.getByRole("button", { name: /open ai tutor/i })).toBeInTheDocument(); // TutorFAB
    expect(screen.getByRole("region", { name: /simulation results/i })).toBeInTheDocument(); // BottomPanel
    expect(screen.getByRole("contentinfo")).toBeInTheDocument(); // StatusBar
  });

  it("hydrates the session on mount and syncs the workspace from the pathname", () => {
    render(<AppShell><div /></AppShell>);
    expect(hydrate).toHaveBeenCalledOnce();
    expect(useShellStore.getState().activeWorkspace).toBe("circuit");
  });
});
