import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { getSession, replace, apiFetch } = vi.hoisted(() => ({
  getSession: vi.fn(),
  replace: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession, signOut: vi.fn() } },
}));
vi.mock("@/lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";

function setSearch(search: string) {
  window.history.replaceState({}, "", `/auth/login${search}`);
}

beforeEach(() => {
  getSession.mockReset();
  apiFetch.mockReset();
  replace.mockClear();
  useAuthStore.setState({ user: null, jwt: null });
  setSearch("");
});

afterEach(() => {
  setSearch("");
});

describe("useAuth.completeSession", () => {
  it("redirects to /dashboard even when the profile fetch fails (issue #14)", async () => {
    apiFetch.mockRejectedValue(new Error("backend down"));

    const { result } = renderHook(() => useAuth());
    // Must not throw — the profile fetch is best-effort.
    await expect(result.current.completeSession("tok")).resolves.toBeUndefined();

    expect(useAuthStore.getState().jwt).toBe("tok");
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("sets the user and redirects on a successful profile fetch", async () => {
    apiFetch.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      role: "student",
    });

    const { result } = renderHook(() => useAuth());
    await result.current.completeSession("tok");

    expect(useAuthStore.getState().user?.email).toBe("a@b.com");
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("honors the middleware ?from param for an internal path", async () => {
    apiFetch.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      role: "student",
    });
    setSearch("?from=/circuit");

    const { result } = renderHook(() => useAuth());
    await result.current.completeSession("tok");

    expect(replace).toHaveBeenCalledWith("/circuit");
  });

  it("ignores an external ?from and falls back to /dashboard", async () => {
    apiFetch.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      role: "student",
    });
    setSearch("?from=//evil.com");

    const { result } = renderHook(() => useAuth());
    await result.current.completeSession("tok");

    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});

describe("useAuth.redirectIfAuthenticated", () => {
  it("redirects and re-sets the session when a live session exists", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });

    const { result } = renderHook(() => useAuth());
    await result.current.redirectIfAuthenticated();

    expect(useAuthStore.getState().jwt).toBe("tok");
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("does nothing when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useAuth());
    await result.current.redirectIfAuthenticated();

    expect(replace).not.toHaveBeenCalled();
    expect(useAuthStore.getState().jwt).toBeNull();
  });
});

describe("useAuth.hydrate", () => {
  it("keeps the session and does not redirect when the profile fetch fails", async () => {
    // Regression: a transient /me failure used to clear the cookie and bounce a
    // signed-in user to /auth/login (visible only on the Google callback's full
    // page load). hydrate must now be best-effort like completeSession.
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    apiFetch.mockRejectedValue(new Error("auth/me 401"));

    const { result } = renderHook(() => useAuth());
    await result.current.hydrate();

    expect(useAuthStore.getState().jwt).toBe("tok");
    expect(useAuthStore.getState().user).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
