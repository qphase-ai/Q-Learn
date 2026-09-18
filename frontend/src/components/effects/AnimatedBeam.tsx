"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedBeamProps {
  /** The shared positioning ancestor both `fromRef`/`toRef` sit inside. */
  containerRef: React.RefObject<HTMLElement>;
  fromRef: React.RefObject<HTMLElement>;
  toRef: React.RefObject<HTMLElement>;
  /** Vertical bow of the connecting curve, in px. Default 40. */
  curvature?: number;
  /** Seconds for one dash cycle to travel the beam. Default 3. */
  duration?: number;
  /** Flip the travel direction. Default false. */
  reverse?: boolean;
  className?: string;
}

/**
 * Draws an animated cyan -> purple gradient beam between two elements that
 * share `containerRef` as a positioning ancestor. Recomputes the path on
 * mount and whenever the container resizes.
 */
export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 40,
  duration = 3,
  reverse = false,
  className,
}: AnimatedBeamProps) {
  const shouldReduceMotion = useReducedMotion();
  const [path, setPath] = React.useState("");
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const gradientId = React.useId().replace(/:/g, "");

  const updatePath = React.useCallback(() => {
    const container = containerRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    if (!container || !from || !to) return;

    const containerRect = container.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();

    const startX = fromRect.left + fromRect.width / 2 - containerRect.left;
    const startY = fromRect.top + fromRect.height / 2 - containerRect.top;
    const endX = toRect.left + toRect.width / 2 - containerRect.left;
    const endY = toRect.top + toRect.height / 2 - containerRect.top;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2 - curvature;

    setDimensions({ width: containerRect.width, height: containerRect.height });
    setPath(`M ${startX},${startY} Q ${midX},${midY} ${endX},${endY}`);
  }, [containerRef, fromRef, toRef, curvature]);

  React.useEffect(() => {
    updatePath();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => updatePath());
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, updatePath]);

  if (!path) return null;

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      width={dimensions.width}
      height={dimensions.height}
      fill="none"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1={reverse ? "100%" : "0%"}
          y1="0%"
          x2={reverse ? "0%" : "100%"}
          y2="0%"
        >
          <stop offset="0%" stopColor="#00F0FF" stopOpacity={0} />
          <stop offset="50%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#B026FF" />
        </linearGradient>
      </defs>
      <path d={path} stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />
      <motion.path
        d={path}
        stroke={`url(#${gradientId})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="40 140"
        animate={
          shouldReduceMotion ? undefined : { strokeDashoffset: reverse ? [0, 180] : [180, 0] }
        }
        transition={shouldReduceMotion ? undefined : { duration, repeat: Infinity, ease: "linear" }}
      />
    </svg>
  );
}
