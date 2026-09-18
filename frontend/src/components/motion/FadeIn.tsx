"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

export interface FadeInProps extends HTMLMotionProps<"div"> {
  /** Seconds to wait before the fade-in starts. */
  delay?: number;
  /** Seconds the fade-in takes. */
  duration?: number;
}

/**
 * Default entrance for content blocks: fades opacity 0 -> 1 on mount.
 * Usage: <FadeIn delay={0.1}>...</FadeIn>
 */
export function FadeIn({ delay = 0, duration = 0.4, children, ...props }: FadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : duration,
        delay: shouldReduceMotion ? 0 : delay,
        ease: "easeOut",
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
