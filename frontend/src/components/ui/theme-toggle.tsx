"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/useMounted";
import { cn } from "@/lib/utils";

/**
 * Icon button that flips between light and dark. If the user is following the
 * OS ("system"), the first click pins the opposite of the current appearance.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = resolvedTheme !== "light";
  const label = mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-overlay/5 hover:text-foreground",
        className,
      )}
    >
      {/* Render nothing theme-specific until mounted: the server can't know the stored theme. */}
      {!mounted ? (
        <span className="h-4 w-4" aria-hidden />
      ) : isDark ? (
        <Sun size={16} aria-hidden />
      ) : (
        <Moon size={16} aria-hidden />
      )}
    </button>
  );
}
