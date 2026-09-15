"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

function setAuthCookie() {
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

  async function login(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      const tokens = await apiFetch<TokenPair>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setJwt(tokens.access_token);
      setAuthCookie();
      const profile = await apiFetch<User>("/api/v1/auth/me", {
        token: tokens.access_token,
      });
      setUser(profile);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function register(
    email: string,
    password: string,
    displayName?: string
  ) {
    setIsLoading(true);
    setError(null);
    try {
      const tokens = await apiFetch<TokenPair>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(displayName ? { display_name: displayName } : {}),
        }),
      });
      setJwt(tokens.access_token);
      setAuthCookie();
      const profile = await apiFetch<User>("/api/v1/auth/me", {
        token: tokens.access_token,
      });
      setUser(profile);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
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
