"use client";

import { LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  const email = user?.email ?? "";
  const displayName = email ? email.split("@")[0] : "Student";
  const initial = (email || "S").charAt(0).toUpperCase();
  const plan = user?.role && user.role !== "student" ? user.role : "Free Plan";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-border/60 py-1 pl-1 pr-2 text-left outline-none transition-colors hover:bg-elevated"
          aria-label="Account menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-cyber-cyan to-electric-purple text-sm font-semibold text-background">
            {initial}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[13px] font-medium capitalize text-foreground">
              {displayName}
            </span>
            <span className="block text-[11px] capitalize text-muted-foreground">{plan}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email || "Not signed in"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()} className="cursor-pointer gap-2 text-error">
          <LogOut size={14} aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
