"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Tracks an element's width with a ResizeObserver. Returns a callback ref to
 * attach and the latest width (0 until measured). Used for container-driven
 * layout where viewport breakpoints don't apply — e.g. the circuit workspace,
 * whose width depends on which LabShell panels are open.
 */
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setWidth(el.getBoundingClientRect().width);
    observer.current = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    observer.current.observe(el);
  }, []);

  return [ref, width];
}
