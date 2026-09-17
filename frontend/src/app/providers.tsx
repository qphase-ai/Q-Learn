"use client";

import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <Toaster
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
        }}
      />
    </TooltipProvider>
  );
}
