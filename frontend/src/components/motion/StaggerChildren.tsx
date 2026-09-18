"use client";

import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion";

export interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  /** Seconds between each child's entrance. */
  staggerDelay?: number;
  /** Animate when scrolled into view (once) instead of immediately on mount. */
  inView?: boolean;
}

/**
 * Parent for a list/grid of `StaggerItem`s — cues each child to enter in sequence.
 * Usage:
 *   <StaggerContainer><StaggerItem>A</StaggerItem><StaggerItem>B</StaggerItem></StaggerContainer>
 */
export function StaggerContainer({
  staggerDelay = 0.08,
  inView = false,
  children,
  ...props
}: StaggerContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: shouldReduceMotion
        ? {}
        : { staggerChildren: staggerDelay, delayChildren: staggerDelay / 2 },
    },
  };

  const viewportProps = inView
    ? { whileInView: "visible" as const, viewport: { once: true } }
    : { animate: "visible" as const };

  return (
    <motion.div initial="hidden" variants={containerVariants} {...viewportProps} {...props}>
      {children}
    </motion.div>
  );
}

export type StaggerItemProps = HTMLMotionProps<"div">;

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const itemVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

/** Child of `StaggerContainer` — fades/slides in (y: 12 -> 0) on its parent's cue. */
export function StaggerItem({ children, ...props }: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div variants={shouldReduceMotion ? itemVariantsReduced : itemVariants} {...props}>
      {children}
    </motion.div>
  );
}
