"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Runs the session-hydration side effect on mount and renders nothing.
 * Mounted by `LabShell`, which every top-level route renders directly, so
 * hydration logic lives in exactly one place.
 */
export default function AuthHydrator() {
  const { hydrate } = useAuth();

  useEffect(() => {
    hydrate().catch((err) => {
      console.warn("AuthHydrator: session hydration failed", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
