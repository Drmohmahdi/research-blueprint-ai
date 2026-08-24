/**
 * Baseerah brand identity — Saudi Academic Premium 2.0
 */

export const brand = {
  style: 'Saudi Academic Premium',
  version: '2.0',
  motion: 'Subtle / Precise / Intelligent',
  effects: [
    'Soft gradients',
    'Low-opacity aurora',
    'Controlled glow',
    'Layered surfaces',
    'Very limited glass',
    'Knowledge-line motif',
  ],
  fonts: {
    arabic: {
      primary: 'IBM Plex Sans Arabic',
      fallback: 'system-ui',
      license: 'SIL Open Font License 1.1 — Google Fonts, commercial SaaS allowed',
      weights: [400, 500, 600, 700],
      reason:
        'IBM Plex Sans Arabic has tighter UI metrics, clearer academic punctuation, and pairs with Inter. Noto was compared on live UI and is wider / more documentary.',
    },
    latin: {
      primary: 'Inter',
      fallback: 'system-ui',
      license: 'SIL Open Font License 1.1 — Google Fonts, commercial SaaS allowed',
      weights: [400, 500, 600, 700],
      reason: 'Inter is more precise for interface numerals, statistics, and mixed Arabic/Latin strings.',
    },
  },
} as const;

export const palette = {
  saudiDeepEmerald: {
    default: '#0B5D3B',
    hover: '#094C30',
    active: '#073B26',
    bright: '#2E8A5C',
    brighter: '#6BB894',
    soft: 'rgba(11, 93, 59, 0.12)',
    glow: 'rgba(11, 93, 59, 0.22)',
    foreground: '#FFFFFF',
  },
  academicMidnightNavy: {
    default: '#0B1F33',
    mid: '#123048',
    elevated: '#1A3F5C',
    ink: '#050F18',
    soft: 'rgba(11, 31, 51, 0.12)',
    foreground: '#F8F7F3',
  },
  mutedWarmGold: {
    default: '#C6A15B',
    hover: '#A88646',
    bright: '#D4B46A',
    soft: 'rgba(198, 161, 91, 0.14)',
    glow: 'rgba(198, 161, 91, 0.18)',
    foreground: '#0B1F33',
  },
  pearl: '#F8F7F3',
  warmSand: '#EBE4D6',
  deepGraphite: '#161A22',
  dataTeal: {
    default: '#167D7F',
    hover: '#126668',
    bright: '#2C9193',
    soft: 'rgba(22, 125, 127, 0.14)',
    foreground: '#FFFFFF',
  },
} as const;
