/**
 * Light Ribbon token constants for standalone HTML artifacts (AC-P14-01).
 * The audit HTML export is a self-contained file that cannot import theme.css,
 * so it consumes these constants instead of embedding raw hex.
 * Mirrors docs/DESIGN.md (normative). Allowlisted for scripts/check-design-tokens.mjs.
 */

export const HTML_EXPORT = {
  bg: '#f3f5f7',
  text: '#22303e',
  textSoft: '#3d4c5c',
  surface: '#ffffff',
  sunken: '#eceff2',
  line: '#dde3e8',
  blueFg: '#1d6fb8',
} as const;
