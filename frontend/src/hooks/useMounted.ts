import { useEffect, useState } from "react";

/**
 * True after the first client render. Use to defer UI that depends on
 * browser-only state (e.g. the persisted theme) and would otherwise cause a
 * hydration mismatch.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
