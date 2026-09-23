import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ActivityBar from "@/components/shell/ActivityBar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/circuit",
}));

describe("ActivityBar", () => {
  it("renders a link per workspace", () => {
    render(<ActivityBar />);
    expect(screen.getByRole("link", { name: /circuit/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings"
    );
  });

  it("marks the active workspace from the pathname", () => {
    render(<ActivityBar />);
    expect(screen.getByRole("link", { name: /circuit/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /dashboard/i })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
