// Client-side Sentry init — Next.js loads this automatically on the browser.
// Supersedes sentry.client.config.ts (deprecated by @sentry/nextjs).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    // Override via NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE; otherwise full
    // tracing in dev, conservative in production.
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
        (process.env.NODE_ENV === "development" ? "1.0" : "0.1")
    ),
    sendDefaultPii: false,
    // Never attach request/response bodies, cookies, or form values — lesson
    // content and student input must not leave the client as event data.
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
      }
      return event;
    },
  });
}

// Required by Next.js for App Router navigation instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
