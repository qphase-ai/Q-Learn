"use client";

import { useState, forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, id, style, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div style={{ marginBottom: "1rem" }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: "0.375rem",
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem",
            background: "var(--bg-elevated)",
            border: `1px solid ${
              error
                ? "var(--error)"
                : focused
                ? "var(--quantum)"
                : "var(--border)"
            }`,
            borderRadius: "6px",
            color: "var(--text-primary)",
            fontSize: "0.875rem",
            outline: "none",
            transition: "border-color 0.15s ease",
            ...style,
          }}
          {...props}
        />
        {error && (
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--error)",
              marginTop: "0.25rem",
              margin: "0.25rem 0 0",
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
