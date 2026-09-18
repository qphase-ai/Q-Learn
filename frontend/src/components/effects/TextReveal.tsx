"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TextRevealProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Text to reveal. Alternatively pass a plain string as `children`. */
  text?: string;
  children?: string;
  /** Seconds between each word's reveal. Default 0.04. */
  staggerDelay?: number;
  /** Delay in seconds before the first word starts. Default 0. */
  delay?: number;
}

/**
 * Splits text into words and reveals them with a staggered fade/slide-up
 * as they enter the viewport. Renders all words immediately, unstaggered,
 * when reduced motion is preferred.
 */
export function TextReveal({
  text,
  children,
  staggerDelay = 0.04,
  delay = 0,
  className,
  ...props
}: TextRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const content = text ?? children ?? "";
  const words = content.split(" ");

  if (shouldReduceMotion) {
    return (
      <span className={className} {...props}>
        {content}
      </span>
    );
  }

  return (
    <span className={cn("inline-block", className)} {...props}>
      {words.map((word, i) => (
        <React.Fragment key={`${word}-${i}`}>
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: delay + i * staggerDelay, duration: 0.4, ease: "easeOut" }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </span>
  );
}
