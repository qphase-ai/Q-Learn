"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SpotlightCardProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Drop-in replacement for `Card` that tracks the cursor and reveals a
 * cyan-tinted radial spotlight under it on hover. Usage is identical to
 * `Card` — pass `CardHeader`/`CardContent`/etc. as children.
 */
export const SpotlightCard = React.forwardRef<HTMLDivElement, SpotlightCardProps>(
  ({ className, children, onMouseMove, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const innerRef = React.useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = React.useState(false);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
      const el = innerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
      }
      onMouseMove?.(e);
    }

    function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
      setIsHovering(true);
      onMouseEnter?.(e);
    }

    function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
      setIsHovering(false);
      onMouseLeave?.(e);
    }

    return (
      <Card
        ref={innerRef}
        className={cn("group relative overflow-hidden", className)}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300",
            isHovering && "opacity-100"
          )}
          style={{
            background:
              "radial-gradient(circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(0,240,255,0.15), transparent 40%)",
          }}
        />
        <div className="relative z-10">{children}</div>
      </Card>
    );
  }
);
SpotlightCard.displayName = "SpotlightCard";
