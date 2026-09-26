"use client";

import { useEffect, useState } from "react";

export type ApiHealth = "checking" | "online" | "offline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Polls `${API_BASE}/health` once on mount. Shared by `StatusBar` and `DashboardHeader`. */
export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health`)
      .then((res) => {
        if (!cancelled) setHealth(res.ok ? "online" : "offline");
      })
      .catch((err) => {
        console.warn("useApiHealth: health check failed", err);
        if (!cancelled) setHealth("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return health;
}
