/**
 * Light Ribbon Theme — design tokens (AC-P14-01, PRD §9.7 FR-701).
 * Normative source of truth; docs/DESIGN.md mirrors this table.
 * Raw hex outside this file / theme.css / icons.tsx is forbidden and
 * enforced by scripts/check-design-tokens.mjs.
 */

/** Semantic triad: tint = surface bg, stroke = border, fg = text color. */
const triad = (tint, stroke, fg) => ({ tint, stroke, fg });

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,ts,tsx}',
    './components/**/*.{html,ts,tsx}',
    // status.ts (lib/transport) emits the bg-dot-* / text-*-fg classes — must not be purged
    './lib/transport/status.ts',
  ],
  theme: {
    extend: {
      colors: {
        // Neutrals
        bg: '#F3F5F7',
        surface: '#FFFFFF',
        sunken: '#ECEFF2',
        line: '#DDE3E8',
        'line-strong': '#C4CED8',
        // Text ramp
        text: { 900: '#22303E', 700: '#3D4C5C', 500: '#6B7A89' },
        // Brand
        brand: { teal: '#2BB39A', blue: '#1D6FB8', mid: '#2491B4' },
        // Semantic triads (tint bg / stroke border / fg text)
        teal: triad('#E7F6F1', '#9AD8C9', '#0F8A72'),
        blue: triad('#EAF2FB', '#A9C8E8', '#1D6FB8'),
        red: triad('#FCEDEC', '#E3A6A0', '#9E2B25'),
        amber: triad('#FBF3E4', '#E7C793', '#9A6A1F'),
        violet: triad('#F0EDFB', '#C9BFE8', '#5B4BC4'),
        // Status dots
        'dot-on': '#2BB39A',
        'dot-wait': '#E19A3C',
        'dot-off': '#9AA7B4',
      },
      borderRadius: {
        card: '16px',
        button: '12px',
        input: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.08)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #2BB39A 0%, #1D6FB8 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
