"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export interface PageTransitionProps {
  children: ReactNode;
  /** Overrides the transition key (defaults to the current pathname via usePathname()). */
  transitionKey?: string;
}

/**
 * Wrap route/workspace content with this so each navigation cross-fades the old
 * content out and slides the new content in, e.g. in a layout:
 *   <PageTransition>{children}</PageTransition>
 */
export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const key = transitionKey ?? pathname;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
