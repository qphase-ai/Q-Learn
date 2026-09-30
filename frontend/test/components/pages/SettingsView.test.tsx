import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import SettingsView from "@/components/pages/SettingsView";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ logout: vi.fn() }) }));

describe("SettingsView theme picker", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  it("marks the active theme and applies the selected one", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <SettingsView />
      </ThemeProvider>,
    );

    const group = screen.getByRole("group", { name: "Theme" });
    expect(group).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Dark", pressed: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(screen.getByRole("button", { name: "Light", pressed: true })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("light");

    await user.click(screen.getByRole("button", { name: "System" }));
    expect(localStorage.getItem("theme")).toBe("system");
    // matchMedia(prefers dark) -> true, so "system" resolves to dark
    expect(document.documentElement).toHaveClass("dark");
  });
});
