import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  iconBefore?: React.ReactNode;
  iconAfter?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  iconBefore,
  iconAfter,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg ds-transition border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-primary-soft)] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';
  
  const variantStyles = {
    primary: 'bg-[var(--ds-primary)] hover:bg-[var(--ds-primary-hover)] text-white shadow-sm active:scale-[0.98]',
    secondary: 'bg-[var(--ds-surface-tertiary)] hover:bg-[var(--ds-background-subtle)] text-[var(--ds-text-primary)] border-[var(--ds-border-subtle)] active:scale-[0.98]',
    outline: 'border-[var(--ds-border-default)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-primary)] active:scale-[0.98]',
    ghost: 'hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]',
    danger: 'bg-[var(--ds-danger)] hover:brightness-95 text-white shadow-sm active:scale-[0.98]',
    success: 'bg-[var(--ds-success)] hover:brightness-95 text-white shadow-sm active:scale-[0.98]',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[36px]',
    md: 'px-4.5 py-2.5 text-sm gap-2 min-h-[44px]',
    lg: 'px-6 py-3.5 text-base gap-2.5 min-h-[50px]',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      type={props.type ?? 'button'}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <RefreshCw size={size === 'sm' ? 12 : 16} className="animate-spin" />
      ) : (
        iconBefore
      )}
      <span>{children}</span>
      {!loading && iconAfter}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon: React.ReactNode;
  ariaLabel: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  ariaLabel,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg ds-transition border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-primary-soft)] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

  const variantStyles = {
    primary: 'bg-[var(--ds-primary)] hover:bg-[var(--ds-primary-hover)] text-white shadow-sm active:scale-[0.98]',
    secondary: 'bg-[var(--ds-surface-tertiary)] hover:bg-[var(--ds-background-subtle)] text-[var(--ds-text-primary)] border-[var(--ds-border-subtle)] active:scale-[0.98]',
    outline: 'border-[var(--ds-border-default)] hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-primary)] active:scale-[0.98]',
    ghost: 'hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)]',
    danger: 'bg-[var(--ds-danger)] hover:brightness-95 text-white shadow-sm active:scale-[0.98]',
    success: 'bg-[var(--ds-success)] hover:brightness-95 text-white shadow-sm active:scale-[0.98]',
  };

  const sizeStyles = {
    sm: 'p-2 min-w-[36px] min-h-[36px]',
    md: 'p-3 min-w-[44px] min-h-[44px]',
    lg: 'p-4 min-w-[50px] min-h-[50px]',
  };

  return (
    <button
      type={props.type ?? 'button'}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      title={ariaLabel}
      {...props}
    >
      {loading ? (
        <RefreshCw size={size === 'sm' ? 12 : 16} className="animate-spin" />
      ) : (
        icon
      )}
    </button>
  );
};
