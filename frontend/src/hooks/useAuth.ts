"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

function setAuthCookie() {
  // Lightweight flag cookie read by middleware.ts for route gating.
  // The real session lives in Supabase's own client storage.
  document.cookie = "qlearn-auth=1; path=/; max-age=604800; SameSite=Lax";
}

function clearAuthCookie() {
  document.cookie = "qlearn-auth=; path=/; max-age=0; SameSite=Lax";
}

export function useAuth() {
  const router = useRouter();
  const { setUser, setJwt, logout: storeLogout } = useAuthStore();
  const jwt = useAuthStore((s) => s.jwt);
  const user = useAuthStore((s) => s.user);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeSession(accessToken: string) {
    setJwt(accessToken);
    setAuthCookie();
    router.replace("/dashboard");

    try {
      const profile = await apiFetch<User>("/api/v1/auth/me", {
        token: accessToken,
      });
      setUser(profile);
    } catch (e) {
      // Transient failures are expected (e.g. backend cold start); AppShell.hydrate()
      // retries the profile request after navigation.
      console.warn("completeSession: profile fetch failed, deferring to hydrate", e);
    }
  }

  async function login(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      await completeSession(data.session.access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function register(email: string, password: string, displayName?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: displayName ? { data: { display_name: displayName } } : undefined,
      });
      if (authError) throw authError;
      // With email confirmation enabled, signUp returns no session until the
      // user confirms — surface that instead of silently failing.
      if (!data.session) {
        setError("Account created — check your email to confirm, then log in.");
        return;
      }
      await completeSession(data.session.access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function loginWithGoogle() {
    setIsLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) throw authError;
      // Browser redirects to Google; the session is completed on /auth/callback.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    storeLogout();
    clearAuthCookie();
    router.push("/auth/login");
  }

  async function hydrate() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return;
    if (useAuthStore.getState().user) return;
    setJwt(session.access_token);
    setAuthCookie();
    try {
      const profile = await apiFetch<User>("/api/v1/auth/me", {
        token: session.access_token,
      });
      setUser(profile);
    } catch (e) {
      // Last line of defense: completeSession already deferred one failure here.
      // If the retry also fails the session is unusable — re-gate to login.
      console.warn("hydrate: profile fetch failed after retry, signing out", e);
      clearAuthCookie();
      router.replace("/auth/login");
    }
  }

  return {
    login,
    loginWithGoogle,
    register,
    logout,
    completeSession,
    hydrate,
    isLoading,
    error,
    user,
    isAuthenticated: !!jwt,
  };
}
