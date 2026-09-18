"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { register, loginWithGoogle, isLoading, error } = useAuth();

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
      <h1 className="mb-6 text-xl font-semibold text-foreground">Create account</h1>

      {displayError && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-error bg-error/10 px-3 py-2.5 text-sm text-error"
        >
          {displayError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Display name (optional)"
          type="text"
          autoComplete="name"
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
        <div className="mt-6">
          <Button type="submit" className="w-full" loading={isLoading}>
            Create account
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
        Already have an account?{" "}
        <Link href="/auth/login" className="text-cyber-cyan no-underline hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
