import React from 'react';
import { Card } from './Card';
import { HelpCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MetricCardProps {
  label: string;
  metric: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  trendLabel?: string;
  tooltipText?: string;
  icon?: React.ReactNode;
  footerAction?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  metric,
  description,
  trend,
  trendLabel,
  tooltipText,
  icon,
  footerAction,
  className = ''
}) => {
  return (
    <Card className={`relative space-y-4 ${className}`} variant="elevated">
      <div className="flex justify-between items-start">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--ds-text-secondary)]">{label}</span>
            {tooltipText && (
              <div className="relative group cursor-help">
                <HelpCircle size={13} className="text-[var(--ds-text-disabled)]" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block z-50 bg-zinc-950 text-white text-[10px] p-2 rounded shadow-lg border border-zinc-800 leading-normal">
                  {tooltipText}
                </div>
              </div>
            )}
          </div>
          <div className="text-2xl font-black text-[var(--ds-text-primary)]">{metric}</div>
        </div>

        {icon && (
          <div className="p-2.5 rounded-xl bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)]">
            {icon}
          </div>
        )}
      </div>

      {(description || trend) && (
        <div className="flex items-center justify-between pt-1 border-t border-[var(--ds-border-subtle)] text-[11px]">
          <span className="text-[var(--ds-text-muted)] truncate">{description}</span>
          
          {trend && (
            <span className={`inline-flex items-center gap-1 font-bold ${
              trend === 'up' ? 'text-emerald-500' :
              trend === 'down' ? 'text-rose-500' : 'text-zinc-500'
            }`}>
              {trend === 'up' && <TrendingUp size={12} />}
              {trend === 'down' && <TrendingDown size={12} />}
              {trend === 'stable' && <Minus size={12} />}
              {trendLabel}
            </span>
          )}
        </div>
      )}

      {footerAction && (
        <div className="pt-2">
          {footerAction}
        </div>
      )}
    </Card>
  );
};
