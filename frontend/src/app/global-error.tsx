"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Catches errors thrown in the root layout, which error.tsx cannot — it must
// render its own <html>/<body> since the root layout failed.
// https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errortsx
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen w-full items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-overlay/10 bg-overlay/5 p-8 text-center backdrop-blur-xl">
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
      </body>
    </html>
  );
}
