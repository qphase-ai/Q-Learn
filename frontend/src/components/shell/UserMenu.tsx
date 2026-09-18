"use client";

import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/hooks/useAuth";

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-muted-foreground">{user?.email ?? "Loading…"}</span>
      <button
        type="button"
        onClick={() => logout()}
        className="rounded-sm border border-border px-2 py-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
