"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Runs the session-hydration side effect on mount and renders nothing.
 * Shared by `AppShell` (thin chrome routes) and `app/dashboard/layout.tsx`
 * (bare dashboard chrome) so hydration logic lives in exactly one place
 * while the two chromes otherwise diverge completely.
 */
export default function AuthHydrator() {
  const { hydrate } = useAuth();

  useEffect(() => {
    hydrate().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
