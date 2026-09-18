"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextReveal } from "@/components/effects";

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
      <h1 className="mb-6 text-xl font-semibold text-foreground">
        <TextReveal text="Sign in" />
      </h1>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-error bg-error/10 px-3 py-2.5 text-sm text-error"
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
        <div className="mt-6">
          <Button type="submit" className="w-full" loading={isLoading}>
            Sign in
          </Button>
        </div>
      </form>

      <div className="my-5 flex items-center gap-3 text-[0.8125rem] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        loading={isLoading}
        onClick={() => loginWithGoogle()}
      >
        Continue with Google
      </Button>

      <p className="mb-0 mt-5 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/auth/register" className="text-cyber-cyan no-underline hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
