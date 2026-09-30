"use client";

import { Settings, LogOut, User, Palette, Info, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/hooks/useAuth";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/utils";

export default function SettingsView() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-purple/15 text-electric-purple">
          <Settings size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
        </div>
      </header>

      {/* Account */}
      <section className="rounded-xl border border-overlay/10 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <User size={15} className="text-cyber-cyan" aria-hidden />
          Account
        </h2>
        <dl className="space-y-3 text-sm">
          <Row label="Email" value={user?.email ?? "Not signed in"} />
          <Row label="Role" value={user?.role ?? "—"} capitalize />
          <Row label="Plan" value="Free Plan" />
        </dl>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-5 flex items-center gap-2 rounded-lg border border-error/40 px-3 py-1.5 text-sm text-error transition-colors hover:bg-error/10"
        >
          <LogOut size={14} aria-hidden />
          Sign out
        </button>
      </section>

      {/* Appearance */}
      <section className="rounded-xl border border-overlay/10 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palette size={15} className="text-cyber-cyan" aria-hidden />
          Appearance
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div id="theme-label" className="text-sm text-foreground">
              Theme
            </div>
            <div className="text-xs text-muted-foreground">
              Choose light, dark, or match your system setting.
            </div>
          </div>
          <ThemePicker />
        </div>
      </section>

      {/* About */}
      <section className="rounded-xl border border-overlay/10 bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info size={15} className="text-cyber-cyan" aria-hidden />
          About
        </h2>
        <p className="text-sm text-muted-foreground">
          Q-Learn is an adaptive, multi-agent platform for learning quantum computing —
          interactive lessons, a circuit builder with real simulation, and an AI tutor.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`truncate text-foreground ${capitalize ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      role="group"
      aria-labelledby="theme-label"
      className="inline-flex rounded-lg border border-overlay/10 bg-overlay/[0.03] p-0.5"
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        // Until mounted the stored theme is unknown, so no option shows as selected.
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors",
              selected
                ? "bg-cyber-cyan/15 text-cyber-cyan"
                : "text-muted-foreground hover:bg-overlay/5 hover:text-foreground",
            )}
          >
            <Icon size={13} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
