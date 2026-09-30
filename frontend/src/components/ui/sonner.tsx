"use client";

import type { ComponentProps } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

/**
 * Themed sonner Toaster (glass styling from the design tokens, so it follows
 * the active light/dark theme). Mounted once by `app/providers.tsx`; `toast`
 * is re-exported for convenience alongside it.
 */
function Toaster({ toastOptions, ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="top-right"
      toastOptions={{
        className: "backdrop-blur-md",
        style: {
          background: "hsl(var(--elevated) / 0.8)",
          border: "1px solid hsl(var(--overlay) / 0.1)",
          color: "hsl(var(--foreground))",
          boxShadow: "0 0 20px hsl(var(--cyber-cyan) / 0.15)",
        },
        ...toastOptions,
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
