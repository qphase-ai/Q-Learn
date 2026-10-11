import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withSentryConfig(nextConfig, {
  // Source map upload (build-time only, needs SENTRY_AUTH_TOKEN in CI).
  // Silent locally when the org/project/token aren't set.
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: {
    // Skip the upload entirely without an auth token — keeps local builds
    // and PR builds working with no Sentry account configured.
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  widenClientFileUpload: true,
  tunnelRoute: false,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
