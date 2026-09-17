"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loginWithGoogle, redirectIfAuthenticated, isLoading, error } =
    useAuth();

  // Send an already-signed-in visitor on to their destination instead of
  // showing the form. redirectIfAuthenticated verifies a live session and
  // re-sets the auth cookie, so this can't loop against middleware.
  useEffect(() => {
    void redirectIfAuthenticated();
    // Run once on mount; redirectIfAuthenticated is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <>
      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 1.5rem",
        }}
      >
        Sign in
      </h1>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0.625rem 0.75rem",
            background: "#f8514914",
            border: "1px solid var(--error)",
            borderRadius: "6px",
            color: "var(--error)",
            fontSize: "0.875rem",
            marginBottom: "1.25rem",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div style={{ marginTop: "1.5rem" }}>
          <Button type="submit" loading={isLoading}>
            Sign in
          </Button>
        </div>
      </form>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          margin: "1.25rem 0",
          color: "var(--text-muted)",
          fontSize: "0.8125rem",
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        or
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <Button
        type="button"
        variant="ghost"
        loading={isLoading}
        onClick={() => loginWithGoogle()}
      >
        Continue with Google
      </Button>

      <p
        style={{
          textAlign: "center",
          fontSize: "0.875rem",
          color: "var(--text-muted)",
          marginTop: "1.25rem",
          marginBottom: 0,
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/register"
          style={{ color: "var(--quantum)", textDecoration: "none" }}
        >
          Create one
        </Link>
      </p>
    </>
  );
}
