"use client";

import { Sun, Moon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/hooks/useTheme";

export default function SettingsWorkspace() {
  const user = useAuthStore((s) => s.user);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and preferences.</p>
      </header>

      <section className="rounded-xl border border-border/60 bg-surface/50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate text-foreground">{user?.email ?? "Not signed in"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize text-foreground">{user?.role ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-border/60 bg-surface/50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</h2>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-foreground">Theme</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-elevated"
          >
            {theme === "dark" ? <Moon size={15} aria-hidden /> : <Sun size={15} aria-hidden />}
            <span className="capitalize">{theme}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
