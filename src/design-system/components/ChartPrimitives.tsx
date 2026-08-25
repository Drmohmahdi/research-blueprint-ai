import type { CSSProperties } from 'react';

/** Shared Recharts tooltip: navy surface, white type, LTR numerals. */
export const dsChartTooltipStyle: CSSProperties = {
  backgroundColor: 'var(--ds-navy)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 12,
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: 700,
  direction: 'ltr',
};

export const dsChartTooltipItemStyle: CSSProperties = {
  color: '#FFFFFF',
  fontSize: 11,
  direction: 'ltr',
};

export const dsChartAxisTick = {
  fill: 'var(--ds-text-secondary)',
  fontSize: 11,
  fontWeight: 700,
} as const;
