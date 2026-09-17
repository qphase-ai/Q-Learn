"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl shadow-glow-cyan animate-fade-in">
        <h1 className="mb-2 text-lg font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg border border-cyber-cyan/40 bg-cyber-cyan/10 px-5 py-2 text-sm font-medium text-cyber-cyan transition-colors hover:bg-cyber-cyan/20 focus-visible:outline-none"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
