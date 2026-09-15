"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { register, isLoading, error } = useAuth();

  const displayError = localError ?? error;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    await register(email, password, displayName || undefined);
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
        Create account
      </h1>

      {displayError && (
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
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Display name"
          type="text"
          autoComplete="name"
          placeholder="Optional"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <div style={{ marginTop: "1.5rem" }}>
          <Button type="submit" loading={isLoading}>
            Create account
          </Button>
        </div>
      </form>

      <p
        style={{
          textAlign: "center",
          fontSize: "0.875rem",
          color: "var(--text-muted)",
          marginTop: "1.25rem",
          marginBottom: 0,
        }}
      >
        Already have an account?{" "}
        <Link
          href="/auth/login"
          style={{ color: "var(--quantum)", textDecoration: "none" }}
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
