// This file configures the Sentry Node.js SDK for the Next.js server runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          const { authorization, cookie, Authorization, Cookie, ...rest } =
            event.request.headers as Record<string, string>;
          event.request.headers = rest;
        }
      }
      return event;
    },
  });
}
