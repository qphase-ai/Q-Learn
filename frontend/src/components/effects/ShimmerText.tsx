import * as React from "react";
import { cn } from "@/lib/utils";

export interface ShimmerTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Wrapper element tag. Default "span". */
  as?: "span" | "div" | "h1" | "h2" | "h3";
}

/**
 * Gradient text (cyan -> purple -> cyan) that shimmers via `animate-shimmer`.
 * Pure CSS — falls back to a static gradient when reduced motion is
 * preferred (`motion-reduce:animate-none`), no JS required.
 */
export function ShimmerText({ className, children, as = "span", ...props }: ShimmerTextProps) {
  const Comp = as;
  return (
    <Comp
      className={cn(
        "inline-block bg-gradient-to-r from-cyber-cyan via-electric-purple to-cyber-cyan bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer motion-reduce:animate-none",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
