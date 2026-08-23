import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'selected' | 'warning' | 'danger' | 'success' | 'ai-accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-2xl border ds-transition overflow-hidden bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] shadow-[0_12px_32px_-26px_rgba(8,76,72,0.55)]';

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const variantStyles = {
    default: 'border-[var(--ds-border-subtle)]',
    elevated: 'border-[var(--ds-border-subtle)] shadow-[0_18px_44px_-28px_rgba(8,76,72,0.55)]',
    interactive: 'border-[var(--ds-border-subtle)] hover:border-[var(--ds-primary)]/40 hover:shadow-[0_20px_42px_-28px_rgba(15,118,110,0.7)] cursor-pointer hover:translate-y-[-3px] active:translate-y-[0px]',
    selected: 'border-[var(--ds-primary)] ring-1 ring-[var(--ds-primary-soft)] bg-[var(--ds-primary-soft)]',
    warning: 'border-[var(--ds-warning)]/30 bg-[var(--ds-warning-soft)]',
    danger: 'border-[var(--ds-danger)]/30 bg-[var(--ds-danger-soft)]',
    success: 'border-[var(--ds-success)]/30 bg-[var(--ds-success-soft)]',
    'ai-accent': 'border-[var(--ds-primary)]/30 bg-[var(--ds-primary-soft)] shadow-sm',
  };

  return (
    <div
      className={`${baseStyles} ${paddingStyles[padding]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
