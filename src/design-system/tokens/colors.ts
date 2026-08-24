import { palette } from './brand';

export const colors = {
  light: {
    background: {
      canvas: palette.pearl,
      subtle: palette.warmSand,
    },
    surface: {
      primary: '#FBFAF7',
      secondary: '#F3EEE6',
      tertiary: '#E8DFD0',
      elevated: '#FFFFFF',
    },
    border: {
      subtle: '#E4DCD0',
      default: '#D4C9B8',
      strong: '#B8AB96',
    },
    text: {
      primary: palette.academicMidnightNavy.default,
      secondary: '#3D4A5C',
      muted: '#6B7585',
      disabled: '#9AA3B0',
    },
  },
  dark: {
    background: {
      canvas: palette.academicMidnightNavy.default,
      subtle: palette.deepGraphite,
    },
    surface: {
      primary: '#121A28',
      secondary: '#1A2333',
      tertiary: '#232C3E',
      elevated: '#2A3448',
    },
    border: {
      subtle: '#243044',
      default: '#33415A',
      strong: '#4A5A73',
    },
    text: {
      primary: palette.pearl,
      secondary: '#C5CBD6',
      muted: '#A3ABB8',
      disabled: '#6A7383',
    },
  },
  brand: {
    primary: {
      default: palette.saudiDeepEmerald.default,
      hover: palette.saudiDeepEmerald.hover,
      active: palette.saudiDeepEmerald.active,
      soft: palette.saudiDeepEmerald.soft,
      foreground: palette.saudiDeepEmerald.foreground,
    },
    institutional: {
      default: palette.academicMidnightNavy.default,
      hover: palette.academicMidnightNavy.mid,
      active: palette.academicMidnightNavy.ink,
      soft: palette.academicMidnightNavy.soft,
      foreground: palette.academicMidnightNavy.foreground,
    },
    gold: {
      default: palette.mutedWarmGold.default,
      hover: palette.mutedWarmGold.hover,
      bright: palette.mutedWarmGold.bright,
      soft: palette.mutedWarmGold.soft,
      foreground: palette.mutedWarmGold.foreground,
    },
    dataTeal: {
      default: palette.dataTeal.default,
      hover: palette.dataTeal.hover,
      bright: palette.dataTeal.bright,
      soft: palette.dataTeal.soft,
      foreground: palette.dataTeal.foreground,
    },
    researchBlue: {
      default: palette.academicMidnightNavy.elevated,
      hover: '#16304C',
      active: palette.academicMidnightNavy.mid,
      soft: 'rgba(26, 51, 80, 0.14)',
      foreground: '#FFFFFF',
    },
    success: {
      default: '#1F7A4D',
      hover: '#17633E',
      active: '#124F32',
      soft: 'rgba(31, 122, 77, 0.14)',
      foreground: '#FFFFFF',
    },
    warning: {
      default: '#B45309',
      hover: '#92400E',
      active: '#78350F',
      soft: 'rgba(180, 83, 9, 0.14)',
      foreground: '#FFFFFF',
    },
    danger: {
      default: '#B42318',
      hover: '#912012',
      active: '#7A1B10',
      soft: 'rgba(180, 35, 24, 0.14)',
      foreground: '#FFFFFF',
    },
    info: {
      default: palette.dataTeal.default,
      hover: palette.dataTeal.hover,
      active: '#0C5F58',
      soft: palette.dataTeal.soft,
      foreground: '#FFFFFF',
    },
  },
};
