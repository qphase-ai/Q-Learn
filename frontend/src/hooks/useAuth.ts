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
    const profile = await apiFetch<User>("/api/v1/auth/me", { token: accessToken });
    setUser(profile);
    router.push("/dashboard");
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

  async function logout() {
    await supabase.auth.signOut();
    storeLogout();
    clearAuthCookie();
    router.push("/auth/login");
  }

  return {
    login,
    register,
    logout,
    isLoading,
    error,
    user,
    isAuthenticated: !!jwt,
  };
}
