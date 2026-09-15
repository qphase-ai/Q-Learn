"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error } = useAuth();

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
