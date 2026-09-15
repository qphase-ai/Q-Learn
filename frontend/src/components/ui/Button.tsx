interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const sizeStyles: Record<
  NonNullable<ButtonProps["size"]>,
  React.CSSProperties
> = {
  sm: { padding: "0.375rem 0.75rem", fontSize: "0.8125rem" },
  md: { padding: "0.625rem 1.25rem", fontSize: "0.875rem" },
  lg: { padding: "0.75rem 1.5rem", fontSize: "1rem" },
};

const variantStyles: Record<
  NonNullable<ButtonProps["variant"]>,
  React.CSSProperties
> = {
  primary: {
    background: "var(--quantum)",
    borderColor: "var(--quantum)",
    color: "#0a0a0a",
  },
  ghost: {
    background: "transparent",
    borderColor: "var(--border)",
    color: "var(--text-secondary)",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        width: "100%",
        fontWeight: 600,
        borderRadius: "6px",
        border: "1px solid",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "opacity 0.15s ease",
        outline: "none",
        fontFamily: "inherit",
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}
