"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

export interface SlideUpProps extends HTMLMotionProps<"div"> {
  /** Seconds to wait before the slide-up starts. */
  delay?: number;
  /** Seconds the slide-up takes. */
  duration?: number;
}

/**
 * Hero / section reveal: fades in while sliding up 24px, once, when scrolled into view.
 * Usage: <SlideUp delay={0.15}>...</SlideUp>
 */
export function SlideUp({ delay = 0, duration = 0.5, children, ...props }: SlideUpProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
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
