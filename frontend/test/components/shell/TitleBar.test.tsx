import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TitleBar from "@/components/shell/TitleBar";
import { useAuthStore } from "@/stores/authStore";
import { useLearningStore } from "@/stores/learningStore";

const logout = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/circuit" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ logout }) }));

beforeEach(() => {
  logout.mockClear();
  useAuthStore.setState({
    user: { id: "u1", email: "student@example.com", role: "student" },
    jwt: "t",
  });
  useLearningStore.setState({ xp: 120, streak: 3 });
});

describe("TitleBar", () => {
  it("shows the active workspace breadcrumb", () => {
    render(<TitleBar />);
    expect(screen.getByText(/circuit/i)).toBeInTheDocument();
  });

  it("shows the user email and xp", () => {
    render(<TitleBar />);
    expect(screen.getByText("student@example.com")).toBeInTheDocument();
    expect(screen.getByText(/120 XP/i)).toBeInTheDocument();
  });

  it("calls logout when the user chooses Sign out", async () => {
    render(<TitleBar />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(logout).toHaveBeenCalledOnce();
  });
});
