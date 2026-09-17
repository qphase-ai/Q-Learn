/**
 * Resolve the post-sign-in destination from the current URL's `?from` param.
 *
 * Middleware writes `?from=<pathname>` when it bounces an unauthenticated user
 * off a protected route. We honor that so they land where they were headed.
 *
 * Only internal absolute paths are allowed: the value must start with a single
 * "/" (not "//", which browsers treat as protocol-relative and would allow an
 * open redirect to an external host). Anything else falls back to /dashboard.
 *
 * Reads `window.location` at call time — only invoke from client event handlers
 * or effects, never during SSR/prerender.
 */
export function safeRedirectTarget(): string {
  if (typeof window === "undefined") return "/dashboard";
  const from = new URLSearchParams(window.location.search).get("from");
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return "/dashboard";
}
