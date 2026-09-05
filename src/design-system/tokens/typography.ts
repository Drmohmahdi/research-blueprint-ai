/**
 * Documents the scale implemented in themes.css + typography.css.
 * Apply in UI via className: text-display, text-h1 … text-caption.
 */
export const typography = {
  fontFamilies: {
    arabic: "'IBM Plex Sans Arabic', system-ui, sans-serif",
    latin: "Inter, system-ui, sans-serif",
    sans: "'IBM Plex Sans Arabic', Inter, system-ui, sans-serif",
    academic: "'IBM Plex Sans Arabic', Inter, system-ui, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  sizes: {
    display: { fontSizeMin: '1.75rem', fontSizeMax: '2.5rem', lineHeight: 1.25, fontWeight: '700' },
    'heading-1': { fontSizeMin: '1.5rem', fontSizeMax: '2rem', lineHeight: 1.28, fontWeight: '700' },
    'heading-2': { fontSizeMin: '1.25rem', fontSizeMax: '1.5rem', lineHeight: 1.32, fontWeight: '600' },
    'heading-3': { fontSize: '1.125rem', lineHeight: 1.4, fontWeight: '600' },
    'heading-4': { fontSize: '1.0625rem', lineHeight: 1.42, fontWeight: '600' },
    'body-lg': { fontSize: '1rem', lineHeight: 1.7, fontWeight: '400' },
    body: { fontSize: '0.9375rem', lineHeight: 1.65, fontWeight: '400' },
    'body-sm': { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: '400' },
    label: { fontSize: '0.8125rem', lineHeight: 1.35, fontWeight: '600' },
    caption: { fontSize: '0.75rem', lineHeight: 1.4, fontWeight: '500' },
    overline: { fontSize: '0.75rem', lineHeight: 1.4, fontWeight: '600' },
    metric: { fontSizeMin: '1.5rem', fontSizeMax: '2rem', lineHeight: 1.2, fontWeight: '700' },
    code: { fontSize: '0.8125rem', lineHeight: 1.35, fontFamily: 'mono' },
  },
};
