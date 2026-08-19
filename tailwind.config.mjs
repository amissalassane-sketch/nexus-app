/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // NEXUS Design Tokens — Warm Ink + Confident White + Volt Signal
        
        // Background palette
        "bg-base": "#0C0C0E",
        "bg-subtle": "#111114",
        "bg-surface": "#17171A",
        "bg-surface-2": "#1E1E22",
        "bg-surface-3": "#27272C",
        
        // Border palette
        "border-subtle": "#1C1C1F",
        "border-default": "#232326",
        "border-strong": "#2C2C30",
        "border-focus": "#3A3A40",
        
        // Text palette
        "text-primary": "#F2F1ED",
        "text-secondary": "#9F9FA6",
        "text-tertiary": "#6E6E76",
        "text-quaternary": "#4A4A50",
        
        // Accent primary (Confident White buttons)
        "accent-primary": "#F2F1ED",
        "accent-primary-fg": "#0C0C0E",
        "accent-primary-hover": "#EAE8E3",
        "accent-ghost-bg": "rgba(242, 241, 237, 0.08)",
        "accent-ghost-hover": "rgba(242, 241, 237, 0.12)",
        
        // Brand Volt Signal
        "volt": "#D2FF4D",
        "volt-fg": "#0C0C0E",
        "volt-subtle": "rgba(210, 255, 77, 0.12)",
        "volt-border": "rgba(210, 255, 77, 0.30)",
        
        // Semantic colors
        "success-fg": "#6EFF8E",
        "success-bg": "rgba(110, 255, 142, 0.12)",
        "success-border": "rgba(110, 255, 142, 0.24)",
        
        "warning-fg": "#FFC857",
        "warning-bg": "rgba(255, 200, 87, 0.12)",
        "warning-border": "rgba(255, 200, 87, 0.28)",
        
        "danger-fg": "#FF5A5F",
        "danger-bg": "rgba(255, 90, 95, 0.12)",
        "danger-border": "rgba(255, 90, 95, 0.28)",
        
        "info-fg": "#8AA8FF",
        "info-bg": "rgba(138, 168, 255, 0.12)",
        "info-border": "rgba(138, 168, 255, 0.24)",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
      },
      fontFamily: {
        sans: [
          "Geist",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "SF Mono",
          "Monaco",
          "monospace",
        ],
      },
      fontSize: {
        // Display: 36px / 40px line-height / 600 weight / -0.03em
        display: ["36px", { lineHeight: "40px", letterSpacing: "-0.03em" }],
        
        // h1: 24px / 32px / 600 / -0.022em
        h1: ["24px", { lineHeight: "32px", letterSpacing: "-0.022em" }],
        
        // h2: 18px / 28px / 600 / -0.015em
        h2: ["18px", { lineHeight: "28px", letterSpacing: "-0.015em" }],
        
        // h3: 15px / 22px / 600 / -0.01em
        h3: ["15px", { lineHeight: "22px", letterSpacing: "-0.01em" }],
        
        // h3-mono: 12px / 16px / 500 / 0.06em / uppercase
        "h3-mono": ["12px", { lineHeight: "16px", letterSpacing: "0.06em" }],
        
        // body-lg: 15px / 24px / 400 / -0.01em
        "body-lg": ["15px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        
        // body: 14px / 22px / 400 / -0.01em
        body: ["14px", { lineHeight: "22px", letterSpacing: "-0.01em" }],
        
        // body-medium: 14px / 22px / 500 / -0.01em
        "body-medium": ["14px", { lineHeight: "22px", letterSpacing: "-0.01em" }],
        
        // small: 13px / 20px / 400 / -0.005em
        small: ["13px", { lineHeight: "20px", letterSpacing: "-0.005em" }],
        
        // caption: 12px / 16px / 400 / 0em
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0em" }],
        
        // label: 12px / 16px / 500 / 0.04em
        label: ["12px", { lineHeight: "16px", letterSpacing: "0.04em" }],
        
        // button: 13.5px / 20px / 500 / -0.01em
        button: ["13.5px", { lineHeight: "20px", letterSpacing: "-0.01em" }],
        
        // mono: 12px / 16px / 400 / 0em
        mono: ["12px", { lineHeight: "16px", letterSpacing: "0em" }],
        
        // mono-small: 11px / 14px / 500 / 0.02em
        "mono-small": ["11px", { lineHeight: "14px", letterSpacing: "0.02em" }],
      },
      spacing: {
        // Base unit 4px (default Tailwind scale)
        // 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 already available
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.16)",
        sm: "0 2px 8px rgba(0, 0, 0, 0.24)",
        md: "0 8px 24px rgba(0, 0, 0, 0.32)",
      },
      animation: {
        shimmer: "shimmer 1.4s infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
    },
  },
  plugins: [
    function ({ addComponents, theme }) {
      addComponents({
        ".focus-ring": {
          "@apply outline-none": {},
          boxShadow: `0 0 0 1px ${theme('colors.bg-base')}, 0 0 0 3px rgba(210, 255, 77, 0.35)`,
        },
        ".quiet-separator": {
          height: "1px",
          backgroundColor: theme('colors.border-default'),
        },
      });
    },
  ],
};

export default config;
