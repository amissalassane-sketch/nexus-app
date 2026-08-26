/**
 * NEXUS — "Pill Atelier Noir" tokens.
 * Ported from src/app/globals.css (Tailwind v4 @theme) to a v3 config so the
 * primitives built here compile unchanged when lifted back into the app.
 * Token NAMES are identical to the app, so class strings are portable verbatim.
 */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        'bg-base': '#000000',
        'bg-subtle': '#080808',
        'bg-surface': '#0f0f0f',
        'bg-surface-2': '#151515',
        'bg-surface-3': '#1c1c1c',

        'border-subtle': 'rgba(255,255,255,0.06)',
        'border-default': 'rgba(255,255,255,0.08)',
        'border-strong': 'rgba(255,255,255,0.14)',
        'border-focus': 'rgba(255,255,255,0.22)',

        'text-primary': '#f2f2f2',
        'text-secondary': '#9b9b9b',
        'text-tertiary': '#828282',
        'text-quaternary': '#6b6b6b',

        accent: '#ffffff',
        'accent-fg': '#000000',
        'accent-hover': '#e6e6e6',
        'accent-badge': '#ede8ff',
        'accent-ghost': 'rgba(255,255,255,0.05)',
        'accent-ghost-hover': 'rgba(255,255,255,0.09)',

        lavender: '#e9e4ff',
        'lavender-subtle': 'rgba(233,228,255,0.1)',
        'lavender-border': 'rgba(233,228,255,0.22)',

        success: '#6fcf97',
        'success-bg': 'rgba(111,207,151,0.09)',
        'success-border': 'rgba(111,207,151,0.2)',
        warning: '#dcb463',
        'warning-bg': 'rgba(220,180,99,0.09)',
        'warning-border': 'rgba(220,180,99,0.2)',
        danger: '#e87b7b',
        'danger-bg': 'rgba(232,123,123,0.09)',
        'danger-border': 'rgba(232,123,123,0.2)',
        info: '#7f9dee',
        'info-bg': 'rgba(127,157,238,0.09)',
        'info-border': 'rgba(127,157,238,0.2)',
      },
      borderRadius: {
        xs: '4px',
        input: '8px',
        nav: '8px',
        row: '8px',
        card: '12px',
        dropdown: '12px',
        panel: '14px',
        empty: '12px',
        auth: '16px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        display: ['34px', { lineHeight: '38px', letterSpacing: '-0.035em', fontWeight: '500' }],
        h1: ['22px', { lineHeight: '28px', letterSpacing: '-0.025em', fontWeight: '600' }],
        h2: ['16px', { lineHeight: '24px', letterSpacing: '-0.015em', fontWeight: '600' }],
        h3: ['14px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['13.5px', { lineHeight: '21px', fontWeight: '400' }],
        'body-medium': ['13.5px', { lineHeight: '21px', fontWeight: '500' }],
        small: ['12.5px', { lineHeight: '18px' }],
        caption: ['11.5px', { lineHeight: '16px' }],
        button: ['13px', { lineHeight: '20px', fontWeight: '500' }],
        mono: ['11.5px', { lineHeight: '16px' }],
      },
      boxShadow: {
        dropdown: '0 10px 30px -8px rgba(0,0,0,0.7)',
        overlay: '0 24px 60px -12px rgba(0,0,0,0.8)',
      },
      transitionTimingFunction: {
        nexus: 'cubic-bezier(0.22,1,0.36,1)',
        'out-expo': 'cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'list-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in 140ms cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 220ms cubic-bezier(0.22,1,0.36,1) both',
        'list-in': 'list-in 220ms cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
