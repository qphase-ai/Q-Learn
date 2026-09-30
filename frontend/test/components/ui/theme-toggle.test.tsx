import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function renderToggle(defaultTheme = "dark") {
  return render(
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    // jsdom has no matchMedia; next-themes needs it for the "system" theme.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  it("switches from dark to light and back, persisting the choice", async () => {
    const user = userEvent.setup();
    renderToggle();

    const toLight = await screen.findByRole("button", { name: "Switch to light mode" });
    expect(document.documentElement).toHaveClass("dark");

    await user.click(toLight);
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("light");

    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("pins the opposite theme when following a light system setting", async () => {
    const user = userEvent.setup();
    renderToggle("system"); // matchMedia(dark) -> false, so system resolves to light

    await user.click(await screen.findByRole("button", { name: "Switch to dark mode" }));
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
