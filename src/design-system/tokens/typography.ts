/**
 * Documents the scale implemented in ../styles/typography.css (the actual
 * source of truth — apply via className, e.g. `<h2 className="text-h2">`).
 * This file exists for non-CSS consumers (chart/canvas text, PDF export)
 * that need the raw numbers; keep both in sync by hand when the scale changes.
 *
 * Display/H1/H2 are fluid in CSS (clamp between the two font sizes below
 * depending on viewport width); the numbers here are the min/max endpoints.
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
    'display-xl': { fontSizeMin: '1.875rem', fontSizeMax: '2.5rem', lineHeight: 1.3, fontWeight: '700' },
    'display-lg': { fontSizeMin: '1.625rem', fontSizeMax: '2rem', lineHeight: 1.25, fontWeight: '700' },
    'heading-1': { fontSizeMin: '1.375rem', fontSizeMax: '1.75rem', lineHeight: 1.3, fontWeight: '700' },
    'heading-2': { fontSizeMin: '1.1875rem', fontSizeMax: '1.5rem', lineHeight: 1.35, fontWeight: '600' },
    'heading-3': { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: '600' },
    'heading-4': { fontSize: '1.125rem', lineHeight: 1.35, fontWeight: '600' },
    'body-lg': { fontSize: '1.0625rem', lineHeight: 1.7, fontWeight: '400' },
    'body': { fontSize: '0.9375rem', lineHeight: 1.6, fontWeight: '400' },
    'body-sm': { fontSize: '0.875rem', lineHeight: 1.45, fontWeight: '400' },
    'label': { fontSize: '0.8125rem', lineHeight: 1.15, fontWeight: '600' },
    'caption': { fontSize: '0.75rem', lineHeight: 1.3, fontWeight: '500' },
    'overline': { fontSize: '0.6875rem', lineHeight: 1.2, fontWeight: '600' },
    'metric': { fontSize: '1.875rem', lineHeight: 1.2, fontWeight: '700' },
    'code': { fontSize: '0.8125rem', lineHeight: 1.25, fontFamily: 'mono' },
  },
};
