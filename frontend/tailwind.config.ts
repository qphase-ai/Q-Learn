import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "qlearn-bg": "#0d1117",
        "qlearn-surface": "#161b22",
        "qlearn-border": "#30363d",
        "qlearn-accent": "#58a6ff",
        "qlearn-pro": "#f78166",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        code: ["var(--font-code)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
