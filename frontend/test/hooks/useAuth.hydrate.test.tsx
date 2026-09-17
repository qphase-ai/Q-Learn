import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { getSession, push, apiFetch } = vi.hoisted(() => ({
  getSession: vi.fn(),
  push: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession, signOut: vi.fn() } },
}));
vi.mock("@/lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";

beforeEach(() => {
  getSession.mockReset();
  apiFetch.mockReset();
  push.mockClear();
  useAuthStore.setState({ user: null, jwt: null });
});

describe("useAuth.hydrate", () => {
  it("loads the user from auth/me without redirecting", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    apiFetch.mockResolvedValue({ id: "u1", email: "a@b.com", role: "student", subscription_status: "free" });

    const { result } = renderHook(() => useAuth());
    await result.current.hydrate();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/auth/me", { token: "tok" });
    expect(useAuthStore.getState().user?.email).toBe("a@b.com");
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useAuth());
    await result.current.hydrate();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
