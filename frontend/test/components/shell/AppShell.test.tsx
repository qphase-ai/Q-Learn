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

beforeEach(() => {
  hydrate.mockClear();
  useShellStore.setState({ rightPanelOpen: true, bottomPanelOpen: true, activeWorkspace: "dashboard", bottomPanelTab: "probabilities" });
});

describe("AppShell", () => {
  it("mounts all six zones and renders children", () => {
    render(
      <AppShell>
        <div>WORKSPACE CONTENT</div>
      </AppShell>
    );
    expect(screen.getByRole("banner")).toBeInTheDocument(); // TitleBar
    expect(screen.getByRole("navigation", { name: /workspaces/i })).toBeInTheDocument(); // ActivityBar
    expect(screen.getByText("WORKSPACE CONTENT")).toBeInTheDocument(); // WorkspaceArea
    expect(screen.getByRole("complementary", { name: /ai tutor/i })).toBeInTheDocument(); // RightPanel
    expect(screen.getByRole("region", { name: /simulation results/i })).toBeInTheDocument(); // BottomPanel
    expect(screen.getByRole("contentinfo")).toBeInTheDocument(); // StatusBar
  });

  it("hydrates the session on mount and syncs the workspace from the pathname", () => {
    render(<AppShell><div /></AppShell>);
    expect(hydrate).toHaveBeenCalledOnce();
    expect(useShellStore.getState().activeWorkspace).toBe("circuit");
  });
});
