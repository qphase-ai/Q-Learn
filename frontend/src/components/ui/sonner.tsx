"use client";

import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

/**
 * Themed sonner Toaster matching the dark-glass styling `app/providers.tsx` already
 * inlines. `providers.tsx` renders its own <Toaster> today and this wave does not
 * touch it — this export exists so future call sites (or a later provider refactor)
 * can `import { Toaster } from "@/components/ui/sonner"` instead of duplicating the
 * theme object. `toast` is re-exported for convenience alongside it.
 */
function Toaster({ toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      toastOptions={{
        className: "backdrop-blur-md",
        style: {
          background: "rgba(20,20,20,0.8)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#e5fdff",
          boxShadow: "0 0 20px rgba(0,240,255,0.15)",
        },
        ...toastOptions,
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
