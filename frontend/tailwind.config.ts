import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "cyber-cyan": {
          DEFAULT: "#00F0FF",
          50: "#E5FDFF",
          100: "#CCFBFF",
          200: "#99F7FF",
          300: "#66F3FF",
          400: "#33F1FF",
          500: "#00F0FF",
          600: "#00C2CC",
          700: "#009199",
          800: "#006166",
          900: "#003033",
          950: "#001A1C",
        },
        "electric-purple": {
          DEFAULT: "#B026FF",
          50: "#F5E9FF",
          100: "#EBD3FF",
          200: "#D7A8FF",
          300: "#C47CFF",
          400: "#C24EFF",
          500: "#B026FF",
          600: "#8C1ECC",
          700: "#691799",
          800: "#460F66",
          900: "#230833",
          950: "#14041D",
        },
        "neon-green": {
          DEFAULT: "#39FF14",
          50: "#EFFFEB",
          100: "#DFFFD6",
          200: "#BFFFAD",
          300: "#9FFF85",
          400: "#6FFF4A",
          500: "#39FF14",
          600: "#2ECC10",
          700: "#22990C",
          800: "#176608",
          900: "#0B3304",
          950: "#061A02",
        },
        background: "hsl(var(--background) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        elevated: "hsl(var(--elevated) / <alpha-value>)",
        border: "hsl(var(--border-ds) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        "muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",
        success: "hsl(var(--success-ds) / <alpha-value>)",
        warning: "hsl(var(--warning-ds) / <alpha-value>)",
        error: "hsl(var(--error-ds) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        code: ["var(--font-code)", "monospace"],
      },
      boxShadow: {
        "glow-cyan": "0 0 20px rgba(0,240,255,0.35)",
        "glow-purple": "0 0 20px rgba(176,38,255,0.35)",
        "glow-green": "0 0 20px rgba(57,255,20,0.35)",
        "glow-cyan-lg": "0 0 40px rgba(0,240,255,0.45)",
        "glow-inner": "inset 0 0 20px rgba(0,240,255,0.15)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        aurora: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 20px rgba(0,240,255,0.35)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 40px rgba(0,240,255,0.55)" },
        },
        beam: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        spotlight: {
          "0%": { opacity: "0", transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: "1", transform: "translate(-50%,-40%) scale(1)" },
        },
        "border-spin": {
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        aurora: "aurora 12s ease infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        beam: "beam 2s linear infinite",
        float: "float 4s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        spotlight: "spotlight 1.2s ease forwards",
        "border-spin": "border-spin 3s linear infinite",
        "fade-in": "fade-in 0.4s ease forwards",
        "slide-up": "slide-up 0.4s ease forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
