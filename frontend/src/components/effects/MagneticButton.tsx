"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MagneticButtonProps extends ButtonProps {
  /** How strongly the button follows the cursor (0-1). Default 0.25. */
  strength?: number;
  /** Maximum pixel offset in any direction. Default 12. */
  maxOffset?: number;
}

/**
 * Wraps `Button` with a magnetic hover effect: the button springs toward the
 * cursor within a clamped radius, and back to center on mouse leave.
 * Renders a plain passthrough `Button` when reduced motion is preferred.
 */
export const MagneticButton = React.forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ strength = 0.25, maxOffset = 12, children, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const [offset, setOffset] = React.useState({ x: 0, y: 0 });

    if (shouldReduceMotion) {
      return (
        <Button ref={ref} {...props}>
          {children}
        </Button>
      );
    }

    function clamp(value: number) {
      return Math.max(-maxOffset, Math.min(maxOffset, value));
    }

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setOffset({
        x: clamp((e.clientX - centerX) * strength),
        y: clamp((e.clientY - centerY) * strength),
      });
    }

    function handleMouseLeave() {
      setOffset({ x: 0, y: 0 });
    }

    return (
      <motion.div
        ref={wrapperRef}
        className={cn("inline-block", props.className?.includes("w-full") && "w-full")}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: "spring", stiffness: 200, damping: 15, mass: 0.5 }}
      >
        <Button ref={ref} {...props}>
          {children}
        </Button>
      </motion.div>
    );
  }
);
MagneticButton.displayName = "MagneticButton";
