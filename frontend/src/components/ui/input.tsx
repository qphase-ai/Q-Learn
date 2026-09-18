"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, id, value, defaultValue, onFocus, onBlur, onChange, ...props },
    ref
  ) => {
    const [focused, setFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(Boolean(value ?? defaultValue ?? ""));
    const shouldReduceMotion = useReducedMotion();
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const isFloating = focused || hasValue;

    // Keep the floating state in sync for controlled inputs whose value changes
    // without going through this input's own onChange (e.g. a programmatic reset).
    React.useEffect(() => {
      if (value !== undefined) setHasValue(String(value).length > 0);
    }, [value]);

    return (
      <div className="mb-4">
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            value={value}
            defaultValue={defaultValue}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            onChange={(e) => {
              setHasValue(e.target.value.length > 0);
              onChange?.(e);
            }}
            className={cn(
              "block h-12 w-full rounded-lg border bg-white/[0.02] px-3 text-sm text-foreground outline-none backdrop-blur-md transition-colors",
              label ? "pb-1.5 pt-4" : "py-3",
              error
                ? "border-error"
                : "border-white/10 focus:border-cyber-cyan focus:shadow-glow-cyan",
              className
            )}
            {...props}
          />
          {label && (
            <motion.label
              htmlFor={inputId}
              initial={false}
              animate={{
                top: isFloating ? "0.4rem" : "50%",
                y: isFloating ? "0%" : "-50%",
                scale: isFloating ? 0.75 : 1,
              }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: "easeOut" }}
              className={cn(
                "pointer-events-none absolute left-3 origin-left select-none text-muted-foreground",
                isFloating && (error ? "text-error" : "text-cyber-cyan")
              )}
            >
              {label}
            </motion.label>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
