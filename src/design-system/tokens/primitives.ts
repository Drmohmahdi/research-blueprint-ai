/**
 * Baseerah Design System 2.0 — primitive color scales
 * Saudi Academic Premium
 *
 * Primary 500 is Saudi Deep Green (#0B5D3B), calibrated for Pearl contrast.
 * Navy 800 is Academic Midnight (#0B1F33).
 * Gold 500 is Warm Academic Gold (#C6A15B) — accent only.
 * Teal 500 is Research Teal (#167D7F) — data / AI.
 */

export const primitive = {
  green: {
    50: '#EAF6EF',
    100: '#D0EBDB',
    200: '#A5D6BB',
    300: '#6BB894',
    400: '#2E8A5C',
    500: '#0B5D3B',
    600: '#094C30',
    700: '#073B26',
    800: '#052B1C',
    900: '#041E14',
    950: '#02110B',
  },
  navy: {
    50: '#E8EEF5',
    100: '#CDD8E6',
    200: '#9BB3CC',
    300: '#5E84A8',
    400: '#2E5A80',
    500: '#1A3F5C',
    600: '#123048',
    700: '#0E283C',
    800: '#0B1F33',
    900: '#081726',
    950: '#050F18',
  },
  gold: {
    50: '#F8F1E2',
    100: '#F0E2C4',
    200: '#E4C98A',
    300: '#D4B46A',
    400: '#C6A15B',
    500: '#C6A15B',
    600: '#A88646',
    700: '#866A36',
    800: '#655028',
    900: '#46381C',
    950: '#2A2110',
  },
  teal: {
    50: '#E7F5F5',
    100: '#C7E6E6',
    200: '#93CDCE',
    300: '#58AEB0',
    400: '#2C9193',
    500: '#167D7F',
    600: '#126668',
    700: '#0E5052',
    800: '#0A3C3D',
    900: '#072A2B',
    950: '#041818',
  },
  sand: {
    50: '#F8F7F3',
    100: '#F3EEE6',
    200: '#EBE4D6',
    300: '#DDD3C2',
    400: '#C9BBA6',
    500: '#B8AB96',
    600: '#9A8C76',
    700: '#7A6E5C',
    800: '#564D41',
    900: '#3A342C',
    950: '#1F1C18',
  },
  graphite: {
    50: '#F4F5F7',
    100: '#E6E8ED',
    200: '#C9CED8',
    300: '#9AA3B0',
    400: '#6B7585',
    500: '#4A5564',
    600: '#3D4A5C',
    700: '#2A3448',
    800: '#1A2333',
    900: '#161A22',
    950: '#0B1F33',
  },
} as const;

export const chartPalette = {
  series: ['#0B5D3B', '#167D7F', '#2E5A80', '#4C5D8A', '#C6A15B', '#C26A5A'],
  publication: ['#1A3F5C', '#5E84A8', '#7A6E5C', '#167D7F', '#0B5D3B', '#C26A5A'],
  names: ['emerald', 'teal', 'navy', 'indigo', 'amber', 'coral'] as const,
};

export const pathAccents = {
  research: { color: '#0B5D3B', soft: 'rgba(11, 93, 59, 0.12)' },
  data: { color: '#167D7F', soft: 'rgba(22, 125, 127, 0.12)' },
  publication: { color: '#2E5A80', soft: 'rgba(46, 90, 128, 0.14)' },
  review: { color: '#5C5A8A', soft: 'rgba(92, 90, 138, 0.14)' },
  promotion: { color: '#C6A15B', soft: 'rgba(198, 161, 91, 0.16)' },
  identity: { color: '#3D6B8A', soft: 'rgba(61, 107, 138, 0.14)' },
} as const;

export const semanticStatus = {
  success: { text: '#1F7A4D', bg: 'rgba(31, 122, 77, 0.12)', border: 'rgba(31, 122, 77, 0.28)' },
  warning: { text: '#B45309', bg: 'rgba(180, 83, 9, 0.12)', border: 'rgba(180, 83, 9, 0.28)' },
  danger: { text: '#B42318', bg: 'rgba(180, 35, 24, 0.12)', border: 'rgba(180, 35, 24, 0.28)' },
  info: { text: '#167D7F', bg: 'rgba(22, 125, 127, 0.12)', border: 'rgba(22, 125, 127, 0.28)' },
  neutral: { text: '#4A5564', bg: 'rgba(74, 85, 100, 0.10)', border: 'rgba(74, 85, 100, 0.22)' },
} as const;
