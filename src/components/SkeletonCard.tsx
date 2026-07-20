import React from 'react';

// ── Shimmer animation injected once ──────────────────────────────────────────
const ShimmerStyle = () => (
  <style>{`
    @keyframes rb-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .rb-skeleton {
      background: linear-gradient(
        90deg,
        var(--ds-surface-secondary) 25%,
        color-mix(in srgb, var(--ds-surface-secondary) 60%, var(--ds-text-muted) 40%) 50%,
        var(--ds-surface-secondary) 75%
      );
      background-size: 800px 100%;
      animation: rb-shimmer 1.4s ease-in-out infinite;
      border-radius: 8px;
    }
  `}</style>
);

// ── Props ─────────────────────────────────────────────────────────────────────
interface SkeletonCardProps {
  lines?: number;
  showHeader?: boolean;
  className?: string;
}

// ── Single skeleton card ──────────────────────────────────────────────────────
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  showHeader = true,
  className = '',
}) => (
  <>
    <ShimmerStyle />
    <div
      className={`bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl p-5 shadow-sm space-y-4 ${className}`}
    >
      {showHeader && (
        <div className="space-y-2 pb-3 border-b border-[var(--ds-border-subtle)]">
          <div className="rb-skeleton h-4 w-2/3" />
          <div className="rb-skeleton h-3 w-1/2 opacity-60" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="rb-skeleton"
            style={{ height: 12, width: `${100 - i * 12}%`, opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
      {/* Footer button placeholder */}
      <div className="rb-skeleton h-8 w-28 rounded-xl mt-2" />
    </div>
  </>
);

// ── 2×2 grid of skeleton cards ────────────────────────────────────────────────
export const SkeletonGrid: React.FC<{ cards?: number }> = ({ cards = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {Array.from({ length: cards }).map((_, i) => (
      <SkeletonCard key={i} lines={3 - (i % 2)} showHeader={i < 2} />
    ))}
  </div>
);

// ── Single line skeleton (for inline use) ─────────────────────────────────────
export const SkeletonLine: React.FC<{ width?: string; height?: number }> = ({
  width = '100%',
  height = 14,
}) => (
  <>
    <ShimmerStyle />
    <div className="rb-skeleton" style={{ width, height }} />
  </>
);
