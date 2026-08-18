import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0A0A0A",
          subtle: "#111111",
          surface: "#171717",
          "surface-2": "#1C1C1C",
          "surface-3": "#232323",
        },
        border: {
          subtle: "rgba(255,255,255,0.06)",
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.12)",
          focus: "rgba(255,255,255,0.20)",
        },
        text: {
          primary: "#F5F5F5",
          secondary: "#8F8F8F",
          tertiary: "#5A5A5A",
          quaternary: "#3A3A3A",
        },
        accent: {
          DEFAULT: "#FFFFFF",
          fg: "#0A0A0A",
          hover: "#E8E8E8",
          badge: "#EDE8FF",
          ghost: "rgba(255,255,255,0.06)",
          "ghost-hover": "rgba(255,255,255,0.10)",
          lavender: "#E9E4FF",
        },
        volt: {
          DEFAULT: "#E9E4FF",
          subtle: "rgba(233,228,255,0.12)",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        pill: "9999px",
      },
      fontFamily: {
        sans: ["Inter", "Geist Sans", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "monospace"],
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": { "0%": { opacity: "0", transform: "scale(0.98) translateY(4px)" }, "100%": { opacity: "1", transform: "scale(1) translateY(0)" } },
        "shimmer": { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 140ms cubic-bezier(0.2,0.8,0.2,1)",
        "scale-in": "scale-in 200ms cubic-bezier(0.2,0.8,0.2,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
