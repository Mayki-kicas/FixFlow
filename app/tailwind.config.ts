import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-alt": "var(--surface-alt)",
        "border-default": "var(--border-default)",
        muted: "var(--muted)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        signal: {
          progress: "var(--signal-progress)",
          done: "var(--signal-done)",
        },
      },
      // Atelier : coins nets (on joue sur les filets, pas les angles mous).
      borderRadius: {
        lg: "0.375rem",
        xl: "0.5rem",
        "2xl": "0.625rem",
      },
      // Atelier : ombres quasi plates — la hiérarchie vient des hairlines.
      boxShadow: {
        "soft-xl": "0 2px 0 rgba(27, 23, 20, 0.04), 0 18px 40px -28px rgba(27, 23, 20, 0.35)",
        "soft-lg": "0 1px 0 rgba(27, 23, 20, 0.04), 0 12px 28px -24px rgba(27, 23, 20, 0.32)",
        "soft-md": "0 1px 0 rgba(27, 23, 20, 0.03), 0 6px 16px -14px rgba(27, 23, 20, 0.28)",
      },
    },
  },
  plugins: [],
};
export default config;
