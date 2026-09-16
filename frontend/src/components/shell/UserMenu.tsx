"use client";

import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/hooks/useAuth";

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-[var(--text-secondary)]">
        {user?.email ?? "Loading…"}
      </span>
      <button
        type="button"
        onClick={() => logout()}
        className="rounded-sm border border-[var(--border)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        Sign out
      </button>
    </div>
  );
}
