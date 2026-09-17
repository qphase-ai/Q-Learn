import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/learn",
  "/circuit",
  "/code",
  "/quiz",
  "/settings",
];

const AUTH_ROUTES = ["/auth/login", "/auth/register"];

// Dev-only escape hatch: when explicitly opted in via env AND not a
// production build, skip all route protection so every page is reachable
// without logging in. Double-gated so it can never bypass auth in prod.
const DEV_NO_AUTH =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_NO_AUTH === "1";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (DEV_NO_AUTH) {
    return NextResponse.next();
  }

  const isAuthenticated = request.cookies.has("qlearn-auth");

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
