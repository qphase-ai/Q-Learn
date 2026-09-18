"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MotionSlot = motion.create(Slot);

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyber-cyan/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-cyber-cyan text-background shadow-glow-cyan hover:brightness-110",
        secondary: "bg-electric-purple text-white shadow-glow-purple hover:brightness-110",
        outline:
          "border border-white/10 bg-white/[0.02] text-foreground backdrop-blur-md hover:bg-white/[0.06]",
        ghost: "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
        destructive: "bg-error text-white hover:brightness-110",
        link: "h-auto bg-transparent p-0 text-cyber-cyan underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  /** Render the props onto the single child element (Radix Slot) instead of a <button>. */
  asChild?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref
  ) => {
    const shouldReduceMotion = useReducedMotion();
    const hoverProps = shouldReduceMotion
      ? {}
      : { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } };

    if (asChild) {
      return (
        <MotionSlot
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          transition={{ duration: 0.15 }}
          {...hoverProps}
          {...props}
        >
          {children}
        </MotionSlot>
      );
    }

    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        className={cn(buttonVariants({ variant, size, className }))}
        transition={{ duration: 0.15 }}
        {...(isDisabled ? {} : hoverProps)}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
