"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlowingBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Thickness in px of the visible rotating rim. Default 1.5. */
  borderWidth?: number;
}

const CONIC_GRADIENT = "conic-gradient(from 0deg, #00F0FF, #B026FF, #39FF14, #00F0FF)";

/**
 * Wraps children with an animated conic-gradient rim (cyan -> purple ->
 * green) that rotates via `animate-border-spin`. Falls back to a static
 * (non-rotating) gradient rim when reduced motion is preferred.
 */
export const GlowingBorder = React.forwardRef<HTMLDivElement, GlowingBorderProps>(
  ({ className, children, borderWidth = 1.5, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    return (
      <div ref={ref} className={cn("relative overflow-hidden rounded-2xl", className)} {...props}>
        <div
          aria-hidden="true"
          className={cn("absolute inset-0 z-0", !shouldReduceMotion && "animate-border-spin")}
          style={{ background: CONIC_GRADIENT }}
        />
        <div
          className="relative z-10 h-full w-full rounded-2xl bg-surface"
          style={{ margin: borderWidth }}
        >
          {children}
        </div>
      </div>
    );
  }
);
GlowingBorder.displayName = "GlowingBorder";
